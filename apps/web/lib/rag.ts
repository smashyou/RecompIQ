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
export async function retrieveKb(opts: RetrieveOptions): Promise<KbHit[]> {
  const supabase = await createSupabaseServerClient();
  const limit = opts.matchCount ?? 6;

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
          filter_slugs: opts.compoundSlugs ?? null,
        });
        if (data && data.length > 0) return data as KbHit[];
      }
    } catch (err) {
      // Embedding failed (likely missing VOYAGE_API_KEY). Fall through to text search.
      console.warn("[rag] embedding lookup failed, falling back to text search:", err);
    }
  }

  // Text-fallback path
  let query = supabase
    .from("peptide_kb")
    .select(
      "id,compound_slug,section,title,text,source_type,source_url,evidence_level",
    );
  if (opts.compoundSlugs && opts.compoundSlugs.length > 0) {
    query = query.in("compound_slug", opts.compoundSlugs);
  }
  // Crude ILIKE on title + text concatenation
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
