import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { embed as gatewayEmbed } from "@/lib/agent";

export interface KbHit {
  id: string;
  compound_slug: string;
  section: string;
  title: string;
  text: string;
  source_type: string;
  source_url: string | null;
  evidence_level: string;
  similarity?: number;
}

interface RetrieveOptions {
  query: string;
  compoundSlugs?: string[];
  matchCount?: number;
  userId?: string;
}

// Retrieves the most relevant peptide_kb rows for a query.
// 1. If embeddings exist on at least one row, generates a query embedding via Voyage
//    and uses the search_peptide_kb RPC for cosine similarity.
// 2. Otherwise, falls back to ILIKE text search against title + text.
// 3. compoundSlugs narrows the search to specific compounds when known
//    (e.g. extracted from the user's active stack or detected in the query).
// Expand any blend slugs to also include their component slugs, so a query
// about e.g. KLOW pulls in GHK-Cu / BPC-157 / TB-500 / KPV evidence too.
async function expandBlendSlugs(slugs: string[] | undefined): Promise<string[] | undefined> {
  if (!slugs || slugs.length === 0) return slugs;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("compounds")
    .select("slug,is_blend,component_slugs")
    .in("slug", slugs);
  const rows = (data ?? []) as {
    slug: string;
    is_blend: boolean | null;
    component_slugs: string[] | null;
  }[];
  const out = new Set(slugs);
  for (const r of rows) {
    if (r.is_blend && Array.isArray(r.component_slugs)) {
      for (const cs of r.component_slugs) if (cs) out.add(cs);
    }
  }
  return Array.from(out);
}

export async function retrieveKb(opts: RetrieveOptions): Promise<KbHit[]> {
  const supabase = await createSupabaseServerClient();
  const baseLimit = opts.matchCount ?? 6;

  // Blends → include their components, so KLOW etc. surface component evidence.
  const slugs = await expandBlendSlugs(opts.compoundSlugs);
  // Each compound now carries ~8-9 curated rows (mechanism, contraindications,
  // literature doses + citations, key references…). Budget enough to cover a
  // compound's key rows, and widen when a blend pulls in components.
  const limit =
    slugs && slugs.length > 1
      ? Math.min(18, slugs.length * 4)
      : slugs && slugs.length === 1
        ? Math.max(baseLimit, 8)
        : baseLimit;

  // Check if we have any embeddings populated at all.
  const { count } = await supabase
    .from("peptide_kb")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null);

  if ((count ?? 0) > 0) {
    try {
      const embedResult = await gatewayEmbed({
        feature: "embeddings",
        input: opts.query,
        userId: opts.userId,
      });
      const queryVec = embedResult.vectors[0];
      if (queryVec) {
        const { data } = await supabase.rpc("search_peptide_kb", {
          query_embedding: queryVec,
          match_count: limit,
          filter_slugs: slugs ?? null,
        });
        if (data && data.length > 0) return data as KbHit[];
      }
    } catch (err) {
      // Embedding failed (likely missing VOYAGE_API_KEY). Fall through to text search.
      console.warn("[rag] embedding lookup failed, falling back to text search:", err);
    }
  }

  // Text-fallback path
  const select = "id,compound_slug,section,title,text,source_type,source_url,evidence_level";
  if (slugs && slugs.length > 0) {
    // Compound(s) known — return their curated rows directly. Do NOT AND-gate on
    // query keywords (that previously suppressed valid rows when the user's
    // wording didn't literally appear in the curated text, e.g. "what is KLOW").
    const { data } = await supabase
      .from("peptide_kb")
      .select(select)
      .in("compound_slug", slugs)
      .limit(200);
    const rows = (data ?? []) as KbHit[];
    // Rank so the most useful rows survive the budget: the originally-queried
    // compound(s) over expanded blend components, then by section usefulness,
    // then cited rows first.
    const wanted = new Set(opts.compoundSlugs ?? []);
    const SECTION_RANK: Record<string, number> = {
      // Contraindications rank highest so they always survive the budget — even
      // a blend's component cautions must not be squeezed out by dosing rows.
      contraindications: 10,
      mechanism: 9,
      dosing: 8,
      evidence: 7,
      use_pattern: 6,
      clinician_discussion: 6,
      side_effects: 4,
      monitoring: 3,
      interactions: 3,
    };
    rows.sort(
      (a, b) =>
        (wanted.has(b.compound_slug) ? 1 : 0) - (wanted.has(a.compound_slug) ? 1 : 0) ||
        (SECTION_RANK[b.section] ?? 0) - (SECTION_RANK[a.section] ?? 0) ||
        (b.source_url ? 1 : 0) - (a.source_url ? 1 : 0),
    );
    return rows.slice(0, limit);
  }

  // No compound detected — crude ILIKE keyword search across the corpus.
  let query = supabase.from("peptide_kb").select(select);
  const words = opts.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 5);
  for (const w of words) {
    query = query.or(`title.ilike.%${w}%,text.ilike.%${w}%`);
  }
  const { data } = await query.limit(limit);
  return (data ?? []) as KbHit[];
}

// Pull compound slugs the user's active regimen uses, so RAG can be biased
// toward them. Reads the regimen model (current items in still-open phases).
export async function userActiveCompoundSlugs(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("regimen_items")
    .select("compounds(slug), regimen_phases!inner(ends_on), regimens!inner(is_active)")
    .eq("user_id", userId)
    .eq("regimens.is_active", true)
    .is("regimen_phases.ends_on", null)
    .is("ends_on", null);
  const rows = (data ?? []) as unknown as { compounds: { slug: string } | null }[];
  return Array.from(new Set(rows.map((r) => r.compounds?.slug).filter(Boolean) as string[]));
}

// Best-effort compound detection in free-form text. Returns slugs whose
// name or alias appears (case-insensitive). Limited to the seeded catalog.
export async function detectCompoundsInText(text: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("compounds").select("slug,name,aliases");
  const compounds = (data ?? []) as { slug: string; name: string; aliases: string[] }[];
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const c of compounds) {
    if (lower.includes(c.name.toLowerCase())) hits.add(c.slug);
    if (lower.includes(c.slug.toLowerCase())) hits.add(c.slug);
    for (const alias of c.aliases ?? []) {
      if (alias && lower.includes(alias.toLowerCase())) hits.add(c.slug);
    }
  }
  return Array.from(hits);
}
