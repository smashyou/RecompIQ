#!/usr/bin/env node
// Seed the peptide_kb corpus from curated content per compound.
// Pulls existing compound rows for mechanism / monitoring / contraindications
// (already curated in the compounds table) and adds 1-2 extra synthesis paragraphs
// per compound. Idempotent — replaces all existing rows for each compound on every run.
//
// Embeddings are NOT generated here. Run `node scripts/embed-kb.mjs` after VOYAGE_API_KEY
// is set to populate the vector column for rows with embedding IS NULL.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envFile = resolve(__dirname, "..", "apps/web/.env.local");
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      const raw = rest.join("=").trim();
      const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      return [k, unquoted];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Curated supplementary content per compound. Each entry adds 1-2 sections beyond
// what's already in compounds.* — focused on "use pattern" / "evidence" / "clinician_discussion".
// Sources are flagged as `curated_synthesis` to be explicit that these are summaries we
// wrote, not direct excerpts from primary literature.
const CURATED = {
  retatrutide: [
    {
      section: "use_pattern",
      title: "Retatrutide — observed dose-response in trials",
      text: "Phase 2 obesity trials (Jastreboff et al., NEJM 2023) titrated participants up over 12-24 weeks, with weight loss continuing through 48 weeks at the highest dose arms. GI side effects clustered in the first 8 weeks of each titration step; many participants required slower step-ups than the protocol default. Higher steady-state doses produced larger weight-loss effects but with proportionally more nausea, particularly at meals high in fat.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "HUMAN_RCT",
    },
    {
      section: "clinician_discussion",
      title: "Retatrutide — what to bring to your clinician",
      text: "Before initiating, request fasting glucose + A1c + lipid panel + lipase as a baseline. Discuss any personal or family history of MTC or MEN-2 (absolute contraindication for incretin-class agents). If on sulfonylureas or insulin, your clinician will likely down-titrate those to avoid hypoglycemia. Plan how to handle GI side effects (e.g. switching to lower-fat / smaller meals during titration). Ask about repeat labs every 4-8 weeks for the first 6 months.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "HUMAN_OBS",
    },
  ],
  "aod-9604": [
    {
      section: "use_pattern",
      title: "AOD-9604 — usage context",
      text: "Originally developed by Metabolic Pharmaceuticals as an oral anti-obesity agent; subcutaneous use is now more common in research and athletic communities. Human trials (Phase 2b) at 1 mg/day for 24 weeks showed modest weight loss vs placebo. Most current real-world use is at lower doses for adjunct fat-loss alongside GLP-1 agonists, primarily on the theory of complementary lipolytic effects without growth-axis stimulation. Note: long-term safety data beyond 1-year trials is limited.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "HUMAN_OBS",
    },
  ],
  "ghk-cu": [
    {
      section: "use_pattern",
      title: "GHK-Cu — common use patterns",
      text: "Most published GHK-Cu research is topical (cosmetic and wound-care formulations). Subcutaneous use in peptide communities is generally lower-dose and intermittent. Reported subjective effects include improved skin quality and post-injury recovery; objective measures are sparse outside topical studies. Copper-restricted users (e.g. Wilson disease) should not use GHK-Cu.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "HUMAN_OBS",
    },
  ],
  "bpc-157": [
    {
      section: "use_pattern",
      title: "BPC-157 — current evidence stance",
      text: "Robust animal data on tendon, ligament, and gastric tissue repair. No published RCT human trials. Most human use is community-reported for tendinopathy, post-surgical recovery, and gut symptoms. Use is research-only by regulation in most jurisdictions; FDA placed BPC-157 on the Section 503A bulks list under Category 2 in 2023, restricting compounding pharmacy access.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "ANIMAL",
    },
  ],
  "tb-500": [
    {
      section: "use_pattern",
      title: "TB-500 — current evidence stance",
      text: "Thymosin-beta-4 has FDA-recognized research applications (corneal healing, cardiac repair trials). The full molecule is distinct from the fragment marketed as TB-500 in peptide communities. Most community use is for soft-tissue injury recovery. Long-term safety in humans is not characterized. Banned by WADA for competitive athletes.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "ANIMAL",
    },
  ],
  kpv: [
    {
      section: "use_pattern",
      title: "KPV — current evidence stance",
      text: "Most studied as an oral anti-inflammatory in models of inflammatory bowel disease. Some peptide-community use as adjunct for GI symptoms or skin inflammation. Human RCT data is very limited.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "ANIMAL",
    },
  ],
  "mots-c": [
    {
      section: "use_pattern",
      title: "MOTS-C — current evidence stance",
      text: "Mitochondrial-derived peptide with animal data on AMPK pathway activation, glucose disposal, and exercise capacity in aged mice. Small human pilot work on metabolic markers exists but is preliminary. Of particular interest in metabolic-syndrome research and longevity-focused use.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "ANIMAL",
    },
  ],
  "nad-plus": [
    {
      section: "use_pattern",
      title: "NAD+ — IV vs precursor strategies",
      text: "Most published research on NAD+ status uses precursors (NR, NMN) given orally because direct NAD+ has poor oral bioavailability. IV NAD+ is widely used in longevity clinics but human trial data on long-term endpoints is sparse. Rapid IV infusion is associated with flushing, chest tightness, and nausea — slower drip rates reduce these. Discuss with a clinician who has run IV NAD+ before, particularly around infusion rate and total dose per session.",
      source_type: "curated_synthesis",
      source_url: null,
      evidence_level: "HUMAN_OBS",
    },
  ],
};

// Map a citation URL to one of peptide_kb's allowed source_type values.
function classifySourceType(url, fallback) {
  const u = (url ?? "").toLowerCase();
  if (/fda\.gov|accessdata|dailymed/.test(u)) return "fda_label";
  if (/clinicaltrials\.gov/.test(u)) return "clinical_trial";
  if (/pubmed|ncbi\.nlm|nejm|jamanetwork|thelancet|lancet|sciencedirect|wiley|springer|frontiersin|mdpi|cell\.com|nature\.com/.test(u))
    return "pubmed";
  if (/investor|lilly|novonordisk|novo-nordisk|press-release|news-release/.test(u)) return "manufacturer";
  return fallback;
}

const EV_RANK = {
  FDA_APPROVED: 6,
  HUMAN_RCT: 5,
  HUMAN_OBS: 4,
  ANIMAL: 3,
  MECHANISTIC: 2,
  ANECDOTAL: 1,
};

function formatDoseRange(low, high, unit) {
  const u = unit ?? "";
  if (low != null && high != null) return low === high ? `${low} ${u}` : `${low}–${high} ${u}`;
  if (low != null) return `${low} ${u}`;
  if (high != null) return `up to ${high} ${u}`;
  return "(range not specified)";
}

async function seedKb() {
  // 1. Load the compound catalog + the curated literature dose references.
  const compounds = await api("/rest/v1/compounds?select=*");
  console.log(`compounds in catalog: ${compounds.length}`);
  const doseRefs = await api("/rest/v1/compound_dose_reference?select=*");
  const idToSlug = new Map(compounds.map((c) => [c.id, c.slug]));
  const refsBySlug = new Map();
  for (const r of doseRefs ?? []) {
    const slug = idToSlug.get(r.compound_id);
    if (!slug) continue;
    if (!refsBySlug.has(slug)) refsBySlug.set(slug, []);
    refsBySlug.get(slug).push(r);
  }
  console.log(`dose references: ${(doseRefs ?? []).length} across ${refsBySlug.size} compounds`);

  // 2. Wipe + rebuild peptide_kb for each compound
  for (const c of compounds) {
    await api(`/rest/v1/peptide_kb?compound_slug=eq.${c.slug}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    const rows = [];

    // Derive entries from existing compound fields
    if (c.mechanism) {
      rows.push({
        compound_slug: c.slug,
        section: "mechanism",
        title: `${c.name} — mechanism`,
        text: c.mechanism,
        source_type: "curated_synthesis",
        evidence_level: c.evidence_level,
      });
    }
    if (Array.isArray(c.monitoring_notes) && c.monitoring_notes.length > 0) {
      rows.push({
        compound_slug: c.slug,
        section: "monitoring",
        title: `${c.name} — monitoring checklist`,
        text:
          "Monitoring recommendations from the compound catalog: " +
          c.monitoring_notes.map((n) => `• ${n}`).join(" "),
        source_type: "curated_synthesis",
        evidence_level: c.evidence_level,
      });
    }
    const allContras = [
      ...(c.absolute_contraindications ?? []).map((r) => `ABSOLUTE: ${r}`),
      ...(c.relative_contraindications ?? []).map((r) => `RELATIVE: ${r}`),
    ];
    if (allContras.length > 0) {
      rows.push({
        compound_slug: c.slug,
        section: "contraindications",
        title: `${c.name} — contraindications`,
        text: allContras.join(". "),
        source_type: "curated_synthesis",
        evidence_level: c.evidence_level,
      });
    }
    if (Array.isArray(c.common_side_effects) && c.common_side_effects.length > 0) {
      rows.push({
        compound_slug: c.slug,
        section: "side_effects",
        title: `${c.name} — common side effects`,
        text: "Commonly reported side effects: " + c.common_side_effects.join(", ") + ".",
        source_type: "curated_synthesis",
        evidence_level: c.evidence_level,
      });
    }

    // Blend composition: enumerate the components (+ mg) so a query for the
    // blend's own slug surfaces what it actually is. Retrieval also expands a
    // blend to its component slugs, so each component's mechanism / evidence /
    // contraindication rows come through too.
    if (c.is_blend && Array.isArray(c.component_mg) && c.component_mg.length > 0) {
      const parts = c.component_mg
        .map((x) => `${x.label}${x.mg ? ` ${x.mg} mg` : ""}`)
        .join(" + ");
      rows.push({
        compound_slug: c.slug,
        // Filed under "dosing" (an allowed section): the key message is that a
        // blend has no combined-product dose — each component is dosed separately.
        section: "dosing",
        title: `${c.name} — blend composition`,
        text: `${c.name} is a multi-peptide blend of: ${parts}. It carries no established combined-product dose — each component is dosed per its own literature. See the individual components for mechanism, evidence grade, and contraindications.`,
        source_type: "curated_synthesis",
        evidence_level: c.evidence_level,
      });
    }

    // Add the curated extras (use patterns / clinician discussion)
    const extras = CURATED[c.slug] ?? [];
    for (const e of extras) {
      rows.push({
        compound_slug: c.slug,
        section: e.section,
        title: e.title,
        text: e.text,
        source_type: e.source_type,
        source_url: e.source_url ?? null,
        evidence_level: e.evidence_level,
      });
    }

    // Literature dose references (real curated ranges + citations from
    // compound_dose_reference). Framed as educational literature — the coach's
    // system prompt forbids turning these into individualized prescriptions.
    // Prefer human data + stronger evidence; cap at 4 distinct contexts per compound.
    const refs = (refsBySlug.get(c.slug) ?? [])
      .slice()
      .sort(
        (a, b) =>
          (b.is_human_data ? 1 : 0) - (a.is_human_data ? 1 : 0) ||
          (EV_RANK[b.evidence_level] ?? 0) - (EV_RANK[a.evidence_level] ?? 0),
      );
    const seenContext = new Set();
    for (const r of refs) {
      const ctxKey = (r.context ?? "").toLowerCase();
      if (seenContext.has(ctxKey)) continue;
      seenContext.add(ctxKey);
      if (seenContext.size > 4) break;
      const range = formatDoseRange(r.low_value, r.high_value, r.unit);
      const freqRoute = [r.frequency, r.route].filter(Boolean).join(" ");
      const humanFlag = r.is_human_data ? "" : " (non-human / mechanistic data — not a human dose)";
      const note = r.notes ? ` ${r.notes}` : "";
      const url = Array.isArray(r.citation) && r.citation[0]?.url ? r.citation[0].url : null;
      rows.push({
        compound_slug: c.slug,
        section: "dosing",
        title: `${c.name} — literature dose${r.context ? ` (${r.context})` : ""}`,
        text: `Literature dose reference${r.context ? ` — ${r.context}` : ""}: ${range}${freqRoute ? ` ${freqRoute}` : ""}.${note}${humanFlag} Educational summary of published/observed ranges — not a recommendation; discuss any protocol with a clinician.`,
        source_type: classifySourceType(url, r.is_human_data ? "clinical_trial" : "pubmed"),
        source_url: url,
        evidence_level: r.evidence_level,
      });
    }

    // Key references row — surfaces the compound's real citations (research links)
    // so the coach can cite actual sources in its <context> block.
    if (Array.isArray(c.citations) && c.citations.length > 0) {
      const cites = c.citations
        .slice(0, 6)
        .map((ci) => {
          const venue = ci.journal ?? ci.source ?? "";
          const meta = [venue, ci.year].filter(Boolean).join(", ");
          return `${ci.title}${meta ? ` (${meta})` : ""}${ci.url ? ` — ${ci.url}` : ""}`;
        })
        .join("; ");
      rows.push({
        compound_slug: c.slug,
        section: "evidence",
        title: `${c.name} — key references`,
        text: `Key references for ${c.name}: ${cites}.`,
        source_type: classifySourceType(c.citations[0]?.url, "pubmed"),
        source_url: c.citations[0]?.url ?? null,
        evidence_level: c.evidence_level,
      });
    }

    if (rows.length > 0) {
      // Normalize so every row has the same key set (PostgREST batch requirement).
      const normalized = rows.map((r) => ({
        compound_slug: r.compound_slug,
        section: r.section,
        title: r.title,
        text: r.text,
        source_type: r.source_type,
        source_url: r.source_url ?? null,
        evidence_level: r.evidence_level,
      }));
      await api("/rest/v1/peptide_kb", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(normalized),
      });
      console.log(`  ${c.slug}: ${rows.length} rows`);
    }
  }
}

try {
  await seedKb();
  console.log("\n✓ peptide_kb seeded");
  console.log("Next: when VOYAGE_API_KEY is set, run `node scripts/embed-kb.mjs` to populate embeddings.");
} catch (err) {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
}
