#!/usr/bin/env node
// Seed named multi-peptide blends (KLOW, GLOW, Wolverine, etc.) as compounds
// rows with is_blend=true + component_slugs. Compositions sourced by the
// blend-research agent (labeled vendor/community/peer-reviewed/regulatory).
//
// Blends carry NO combined-product dose (none is established) and are graded
// ANECDOTAL. Descriptions below are written in our own words — educational,
// non-prescriptive. Cautions shown in the UI are the union of the components'.
//
// Idempotent upsert by slug. Run: node scripts/seed-blends.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k, rest.join("=").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")];
    }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

// Shared cross-cutting cautions for unregulated research-peptide blends.
const COMMON_CAUTIONS = [
  "No human trial has studied this combination as a formulation — any benefit is extrapolated from individual components, mostly animal data.",
  "Compositions and ratios vary by vendor; the same blend name is not a standardized formulation.",
  "Research-chemical sourcing is unregulated — purity, sterility, and endotoxin levels are not independently verified.",
  "Heightened caution with autoimmune disease, active or prior cancer, and pregnancy/lactation — no human safety data in these groups.",
];
const BPC_CAUTION =
  "Contains BPC-157, which the FDA placed on the Category 2 bulk-substance list (2023), prohibiting US compounding.";
const GH_CAUTION =
  "GH-axis stimulation carries theoretical risks (insulin resistance, fluid retention, possible stimulation of pre-existing tumors); caution with diabetes, insulin resistance, or active malignancy.";

const FDA_503A = {
  source: "FDA (regulatory)",
  title: "Bulk Drug Substances Used in Compounding under 503A (BPC-157 Category 2)",
  url: "https://www.fda.gov/drugs/human-drug-compounding/bulk-drug-substances-used-compounding-under-section-503a-fdc-act",
  year: 2023,
};
const BPC_REVIEW = {
  source: "Front. Pharmacol. (peer-reviewed)",
  title: "Stable gastric pentadecapeptide BPC-157 and wound healing (component, animal/mechanistic)",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8275860/",
  year: 2021,
};

const BLENDS = [
  {
    slug: "klow",
    name: "KLOW",
    aliases: ["KLOW Blend", "Quad Healing Blend"],
    category: "tissue_repair",
    component_slugs: ["ghk-cu", "bpc-157", "tb-500", "kpv"],
    short_description:
      "KLOW is a community/vendor blend of four research peptides — GHK-Cu, BPC-157, TB-500, and KPV — marketed for tissue repair and inflammation. It is not a single compound, is not FDA-approved, and has no human trial data as a combined formulation.",
    mechanism:
      "Each component targets a different repair pathway in animal/in-vitro models: GHK-Cu (copper tripeptide) is associated with collagen/elastin synthesis and antioxidant gene expression; BPC-157 with angiogenesis and tendon/ligament healing in rodents; TB-500 (a thymosin β4 fragment) with actin polymerization and cell migration; KPV (an α-MSH fragment) with anti-inflammatory modulation. The marketed rationale is simultaneous matrix repair, vascular remodeling, and inflammation control — mechanistically plausible but unvalidated in humans as a blend.",
    relative_contraindications: [BPC_CAUTION, ...COMMON_CAUTIONS],
    citations: [BPC_REVIEW, FDA_503A],
  },
  {
    slug: "glow",
    name: "GLOW",
    aliases: ["GLOW Blend", "GLOW Mix"],
    category: "tissue_repair",
    component_slugs: ["ghk-cu", "bpc-157", "tb-500"],
    short_description:
      "GLOW is the three-component predecessor to KLOW (GHK-Cu + BPC-157 + TB-500, without KPV), marketed for connective-tissue repair and skin quality. Not a single compound, not FDA-approved, and no human trial data as a combined formulation.",
    mechanism:
      "Mirrors KLOW minus the anti-inflammatory KPV component: GHK-Cu for copper-mediated matrix and antioxidant effects, BPC-157 for proposed angiogenic/tendon effects in rodents, TB-500 for proposed cytoskeletal/cell-migration effects. Vendor positioning emphasizes both skin appearance and soft-tissue recovery — neither validated in human trials.",
    relative_contraindications: [BPC_CAUTION, ...COMMON_CAUTIONS],
    citations: [BPC_REVIEW, FDA_503A],
  },
  {
    slug: "wolverine",
    name: "Wolverine",
    aliases: ["Wolverine Blend", "Wolverine Stack"],
    category: "tissue_repair",
    component_slugs: ["bpc-157", "tb-500"],
    short_description:
      "Wolverine is the simplest and most widely referenced healing blend — BPC-157 + TB-500. Not a single compound, not FDA-approved, and no human trial has studied the combination.",
    mechanism:
      "Proposed complementary action in animal models: BPC-157 hypothesized to act locally at injury sites (angiogenesis, growth-factor receptor expression) while TB-500 acts more systemically (actin polymerization, cell migration, vessel formation). Often summarized in vendor copy as one peptide 'building roads' and the other 'sending crews' — a memorable but unverified simplification.",
    relative_contraindications: [
      BPC_CAUTION,
      "Some clinics substitute Pentadeca Arginate (PDA) for BPC-157; PDA has no independent human clinical data either.",
      ...COMMON_CAUTIONS,
    ],
    citations: [BPC_REVIEW, FDA_503A],
  },
  {
    slug: "cjc-ipa-blend",
    name: "CJC-1295 / Ipamorelin Blend",
    aliases: ["CJC/Ipa", "GH Peptide Blend", "GHRH/GHRP Blend"],
    category: "growth_factor",
    component_slugs: ["cjc-1295-dac", "mod-grf-1-29", "ipamorelin"],
    short_description:
      "The most widely used named GH-peptide combination — a GHRH analog (CJC-1295, with or without DAC) plus the selective secretagogue Ipamorelin. Marketed for body composition, recovery, and sleep. Not FDA-approved; no RCT of the combined formulation.",
    mechanism:
      "Dual-pathway GH stimulation: CJC-1295 activates pituitary GHRH receptors (increasing GH synthesis and pulse amplitude) while Ipamorelin activates the ghrelin/GH-secretagogue receptor. Because the two converge on the same somatotroph output, the combination raises GH pulsatility supra-additively in animal models. Note: CJC-1295 WITH DAC (~8-day half-life) and WITHOUT DAC / Mod GRF 1-29 (~30-min half-life) are pharmacologically distinct and not interchangeable.",
    relative_contraindications: [
      GH_CAUTION,
      "CJC-1295 with DAC has a very long half-life (~8 days) — dosing errors are hard to reverse.",
      ...COMMON_CAUTIONS,
    ],
    citations: [
      {
        source: "Clin Interv Aging (peer-reviewed)",
        title: "Sermorelin/GHRH-analog context for GH-secretagogue therapy (component context)",
        url: "https://pubmed.ncbi.nlm.nih.gov/18044214/",
        year: 2006,
      },
    ],
  },
  {
    slug: "cjc-ipa-ghrp2-blend",
    name: "CJC-1295 / Ipamorelin / GHRP-2 Triple Blend",
    aliases: ["Triple GH Blend", "GH Triple Stack"],
    category: "growth_factor",
    component_slugs: ["cjc-1295-dac", "mod-grf-1-29", "ipamorelin", "ghrp-2"],
    short_description:
      "A three-way GH-secretagogue blend adding GHRP-2 to the CJC/Ipamorelin base for additional GH amplitude. Not FDA-approved; no human trial of the combination.",
    mechanism:
      "Attempts to saturate both the GHRH pathway (CJC-1295) and the ghrelin-receptor pathway (Ipamorelin + the more potent GHRP-2) for maximal GH pulse output. GHRP-2 also raises cortisol and prolactin more than Ipamorelin, so the combined endocrine load of three simultaneous GH-axis agonists is greater — and uncharacterized in humans.",
    relative_contraindications: [
      GH_CAUTION,
      "GHRP-2 stimulates cortisol and prolactin in addition to GH; the combined load of three secretagogues is not characterized in humans.",
      ...COMMON_CAUTIONS,
    ],
    citations: [],
  },
  {
    slug: "sentinel",
    name: "Sentinel",
    aliases: ["Sentinel Blend", "Immune Fortification Blend"],
    category: "other",
    component_slugs: ["thymosin-alpha-1", "bpc-157", "kpv", "ll-37"],
    short_description:
      "An immune/gut-mucosa blend pairing Thymosin α-1 (the most clinically studied component) with BPC-157, KPV, and LL-37. Sold by at least one compounding pharmacy as a physician-dispensed product — which is not FDA approval. No RCT of the combination.",
    mechanism:
      "Targets the intersection of immune competence and gut-barrier integrity: Thymosin α-1 supports T-cell maturation and NK function (with genuine human trial data as a single agent, approved in some countries but not the US FDA); BPC-157 proposed gut-mucosal repair; KPV anti-inflammatory α-MSH modulation; LL-37 antimicrobial membrane activity. The combined immunostimulatory burden is unstudied.",
    relative_contraindications: [
      BPC_CAUTION,
      "LL-37 is membrane-active with limited human parenteral safety data and theoretical hemolytic potential at high concentrations.",
      "Immune-stimulating peptides carry theoretical autoimmune-flare risk — caution with autoimmune disease.",
      ...COMMON_CAUTIONS,
    ],
    citations: [
      {
        source: "ScientificWorldJournal (peer-reviewed)",
        title: "Thymosin α-1 immune modulation (component context)",
        url: "https://pubmed.ncbi.nlm.nih.gov/17982579/",
        year: 2007,
      },
      FDA_503A,
    ],
  },
  {
    slug: "kalm",
    name: "KALM",
    aliases: ["Kalm Blend", "Semax / Selank Blend"],
    category: "other",
    component_slugs: ["semax", "selank"],
    short_description:
      "A two-component nootropic/anxiolytic blend of Semax and Selank, marketed for focus plus calm. Both are approved drugs in Russia but not the US FDA; no RCT of the combination, and the underlying single-agent evidence has methodological limits.",
    mechanism:
      "Semax (an ACTH(4-7) analog) is associated with BDNF upregulation and is used in Russia for stroke recovery and cognition; Selank (a tuftsin analog) has anxiolytic/nootropic effects attributed to GABAergic and immune modulation. The marketed pairing is 'focus without the edge,' combining cognitive activation with anxiolytic grounding.",
    relative_contraindications: [
      "Approved as drugs only in Russia (not US/EU); Western RCT replication is limited.",
      "Interactions with psychiatric medications (anxiolytics, antidepressants, stimulants) are not characterized.",
      ...COMMON_CAUTIONS,
    ],
    citations: [
      {
        source: "Neurosci Behav Physiol (peer-reviewed)",
        title: "Semax, an ACTH(4-7) analog with nootropic properties (component context)",
        url: "https://pubmed.ncbi.nlm.nih.gov/15929516/",
        year: 2005,
      },
    ],
  },
  {
    slug: "longevity-antiaging-stack",
    name: "Longevity / Anti-Aging Stack",
    aliases: ["Anti-Aging Stack", "Longevity Stack", "Cellular Longevity Stack"],
    category: "longevity",
    component_slugs: ["epitalon", "ss-31", "mots-c", "ghk-cu", "nad-plus", "humanin"],
    short_description:
      "A family of community longevity stacks (commonly Epitalon, SS-31, MOTS-c, GHK-Cu, NAD+, and Humanin) marketed for multi-mechanism aging intervention. No single standardized blend; composition varies, none is FDA-approved, and there is no human trial of any multi-component version.",
    mechanism:
      "Each component targets a different aging hallmark in preclinical work: Epitalon (telomere/telomerase, mostly Russian data), SS-31 (inner-mitochondrial-membrane / cardiolipin stabilization — note its lead clinical trial, BENE, missed its primary endpoint), MOTS-c (AMPK-mediated metabolic flexibility), GHK-Cu (matrix integrity, topical human data only), and NAD+ precursors (sirtuin/PARP and mitochondrial energy metabolism). The multi-target logic is coherent but far ahead of human evidence for these peptides combined.",
    relative_contraindications: [
      "SS-31 (Bendavia) missed its primary endpoint in a Phase 2 renal trial; longevity outcomes are unproven.",
      "Supraphysiologic telomerase activation is a theoretical oncologic concern.",
      "AMPK activators (MOTS-c) may interact with metformin or GLP-1 agents — clinician oversight advised.",
      ...COMMON_CAUTIONS,
    ],
    citations: [
      {
        source: "Eur J Heart Fail (peer-reviewed)",
        title: "SS-31 (Bendavia) Phase 2 — negative primary endpoint (component context)",
        url: "https://pubmed.ncbi.nlm.nih.gov/27097606/",
        year: 2016,
      },
    ],
  },
];

async function main() {
  // Validate component slugs exist in the catalog.
  const existing = await api(`/rest/v1/compounds?select=slug`);
  const known = new Set(existing.map((c) => c.slug));
  for (const b of BLENDS) {
    const missing = b.component_slugs.filter((s) => !known.has(s));
    if (missing.length) console.warn(`  ! ${b.slug}: missing component slugs ${missing.join(", ")}`);
  }

  const rows = BLENDS.map((b) => ({
    slug: b.slug,
    name: b.name,
    aliases: b.aliases ?? [],
    category: b.category,
    evidence_level: "ANECDOTAL",
    fda_approved: false,
    is_blend: true,
    component_slugs: b.component_slugs,
    short_description: b.short_description,
    mechanism: b.mechanism,
    typical_route: null,
    monitoring_notes: [],
    absolute_contraindications: [],
    relative_contraindications: b.relative_contraindications ?? [],
    common_side_effects: [],
    serious_adverse_events: [],
    citations: b.citations ?? [],
  }));

  await api(`/rest/v1/compounds?on_conflict=slug`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  for (const b of BLENDS) console.log(`  ✓ ${b.slug}: ${b.component_slugs.length} components`);
  console.log(`\n✓ seeded ${rows.length} blends`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
