#!/usr/bin/env node
// Seed compound_dose_reference with EDUCATIONAL literature dose ranges.
//
// Every row below was sourced by the evidence-researcher agent from reputable
// citations (FDA, PubMed/PMC, ClinicalTrials.gov, peer-reviewed journals) and
// reviewed by the safety-reviewer agent. Where no established human dose exists
// (most research peptides), the range is intentionally null with an honest note
// and is_human_data=false — we do NOT fabricate or extrapolate numbers.
//
// Idempotent: deletes existing references for each compound, then re-inserts.
// Run: node scripts/seed-dose-references.mjs

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
      return [k, raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// slug → array of reference rows. Numbers and citations only where a real,
// cited source provides them; otherwise null + honest note.
const REFERENCES = {
  retatrutide: [
    {
      context: "Phase 2 obesity RCT dose arms",
      route: "sc",
      low_value: 1,
      high_value: 12,
      unit: "mg",
      frequency: "weekly",
      evidence_level: "HUMAN_RCT",
      is_human_data: true,
      citation: [
        {
          source: "NEJM",
          title: "Triple-Hormone-Receptor Agonist Retatrutide for Obesity — A Phase 2 Trial",
          url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2301972",
          year: 2023,
        },
      ],
      notes:
        "Dose arms of 1/4/8/12 mg weekly SC, reached via staged escalation from a 2 mg start. Investigational; not FDA-approved.",
    },
    {
      context: "Phase 3 TRIUMPH program dose range",
      route: "sc",
      low_value: 2,
      high_value: 12,
      unit: "mg",
      frequency: "weekly",
      evidence_level: "HUMAN_RCT",
      is_human_data: true,
      citation: [
        {
          source: "Eli Lilly / ClinicalTrials.gov",
          title: "TRIUMPH Phase 3 program (retatrutide)",
          url: "https://investor.lilly.com/news-releases/news-release-details/lillys-triple-agonist-retatrutide-delivered-weight-loss-average",
          year: 2025,
        },
      ],
      notes: "Phase 3 doses 2/4/6/9/12 mg weekly SC. Press-release results pending full peer review.",
    },
  ],
  "aod-9604": [
    {
      context: "Phase 2 oral obesity trials",
      route: "oral",
      low_value: 0.25,
      high_value: 30,
      unit: "mg",
      frequency: "once daily",
      evidence_level: "HUMAN_RCT",
      is_human_data: true,
      citation: [
        {
          source: "J Endocrinol Metab",
          title: "Safety and Tolerability of the Hexadecapeptide AOD9604 in Humans",
          url: "https://www.jofem.org/index.php/jofem/article/view/157/194",
          year: 2013,
        },
      ],
      notes:
        "All human trials used ORAL dosing. The definitive 24-week Phase IIb failed its weight-loss endpoint; development was terminated in 2007. The 1 mg arm showed the greatest loss.",
    },
    {
      context: "Subcutaneous community use (no human trial data)",
      route: "sc",
      low_value: null,
      high_value: null,
      unit: "mg",
      frequency: null,
      evidence_level: "ANECDOTAL",
      is_human_data: false,
      citation: [],
      notes:
        "The subcutaneous route common in the peptide community has NO published human safety or efficacy trial. Not evidence-based.",
    },
  ],
  "nad-plus": [
    {
      context: "IV infusion (small pilot studies)",
      route: "iv",
      low_value: 500,
      high_value: 750,
      unit: "mg",
      frequency: "per infusion",
      evidence_level: "HUMAN_OBS",
      is_human_data: true,
      citation: [
        {
          source: "Frontiers in Aging Neuroscience",
          title: "Plasma/urine NAD+ metabolome during a 6-hour IV NAD+ infusion (pilot)",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6751327/",
          year: 2019,
        },
        {
          source: "Frontiers in Aging",
          title: "IV NAD+ vs NR: a retrospective tolerability pilot",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12907335/",
          year: 2026,
        },
      ],
      notes:
        "Only small pilots (n=6–11). 500 mg IV caused universal tachycardia, chest pressure and GI symptoms during infusion; slower infusion is better tolerated. No Phase I dose-finding RCT exists. Distinct from oral NR/NMN precursors.",
    },
    {
      context: "Subcutaneous direct NAD+ (no human trial data)",
      route: "sc",
      low_value: null,
      high_value: null,
      unit: "mg",
      frequency: null,
      evidence_level: "ANECDOTAL",
      is_human_data: false,
      citation: [],
      notes: "No published human trial for SC direct NAD+. Community dose figures are anecdotal.",
    },
  ],
  "ghk-cu": [
    {
      context: "Topical cosmetic / dermatology",
      route: "topical",
      low_value: null,
      high_value: null,
      unit: "mcg",
      frequency: "twice daily (topical)",
      evidence_level: "HUMAN_OBS",
      is_human_data: true,
      citation: [
        {
          source: "JAAD",
          title: "Leyden et al. — GHK-Cu facial cream, 12-week split-face trial",
          url: "https://pubmed.ncbi.nlm.nih.gov/11807736/",
          year: 2002,
        },
        {
          source: "Cosmetics (MDPI)",
          title: "Topical Peptide Treatments with Effective Anti-Aging Results",
          url: "https://www.mdpi.com/2079-9284/4/2/16",
          year: 2017,
        },
      ],
      notes:
        "Peer-reviewed human data is TOPICAL only (e.g. ~0.68% solution; formulations applied 1–2x daily). Stored without a numeric injected dose because it is a formulation concentration, not an injection.",
    },
    {
      context: "Injectable / systemic (no human dose established)",
      route: "sc",
      low_value: null,
      high_value: null,
      unit: "mcg",
      frequency: null,
      evidence_level: "ANIMAL",
      is_human_data: false,
      citation: [],
      notes:
        "No established human injectable dose. FDA classified GHK-Cu (2023) as a bulk substance not permitted in compounded drugs. Animal-to-human extrapolations are explicitly speculative.",
    },
  ],
  "bpc-157": [
    {
      context: "No established human dose",
      route: null,
      low_value: null,
      high_value: null,
      unit: "mcg",
      frequency: null,
      evidence_level: "ANIMAL",
      is_human_data: false,
      citation: [
        {
          source: "ClinicalTrials.gov",
          title: "Phase I oral BPC-157 (NCT02637284) — results never published",
          url: "https://clinicaltrials.gov/study/NCT02637284",
          year: 2015,
        },
      ],
      notes:
        "No completed peer-reviewed human RCT. The one registered Phase I (1 mg oral) never published results. FDA Category 2 (2023): not permitted in compounded products. Community doses are anecdotal.",
    },
  ],
  "tb-500": [
    {
      context: "No established human dose (TB-500 fragment)",
      route: null,
      low_value: null,
      high_value: null,
      unit: "mcg",
      frequency: null,
      evidence_level: "ANIMAL",
      is_human_data: false,
      citation: [
        {
          source: "Br J Clin Pharmacol",
          title: "First-in-human Phase I of recombinant full-length thymosin β4 (a different molecule)",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8419156/",
          year: 2021,
        },
      ],
      notes:
        "No human trial has tested the TB-500 fragment (7-aa). Phase I human dosing exists only for full-length thymosin β4 (43-aa) — a DIFFERENT molecule — and must not be applied to TB-500.",
    },
  ],
  kpv: [
    {
      context: "No established human dose",
      route: null,
      low_value: null,
      high_value: null,
      unit: "mcg",
      frequency: null,
      evidence_level: "ANIMAL",
      is_human_data: false,
      citation: [
        {
          source: "Gastroenterology",
          title: "PepT1-Mediated Tripeptide KPV Uptake Reduces Intestinal Inflammation (animal/in-vitro)",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2431115/",
          year: 2008,
        },
      ],
      notes:
        "No registered or published human trial. Evidence is animal colitis models plus in-vitro mechanism only. Community doses are anecdotal.",
    },
  ],
  "mots-c": [
    {
      context: "No established human dose (native MOTS-c)",
      route: null,
      low_value: null,
      high_value: null,
      unit: "mg",
      frequency: null,
      evidence_level: "ANIMAL",
      is_human_data: false,
      citation: [
        {
          source: "Nature Communications",
          title: "MOTS-c, an exercise-induced mitochondrial-encoded regulator (animal + human observational)",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7817689/",
          year: 2021,
        },
      ],
      notes:
        "No human interventional trial of native MOTS-c. Human data is limited to endogenous level correlations (exercise, aging, metabolic disease).",
    },
    {
      context: "CB4211 analog (NOT native MOTS-c) — Phase 1b",
      route: "sc",
      low_value: 25,
      high_value: 25,
      unit: "mg",
      frequency: "once daily",
      evidence_level: "HUMAN_OBS",
      is_human_data: true,
      citation: [
        {
          source: "AASLD 2021 (CohBar Inc.)",
          title: "CB4211 Phase 1b in NAFLD/obesity — conference poster (n=20, not peer-reviewed)",
          url: "https://cdek.pharmacy.purdue.edu/trial/NCT03998514/",
          year: 2021,
        },
      ],
      notes:
        "CB4211 is a proprietary structural analog of MOTS-c, NOT native MOTS-c — pharmacology may differ. n=20 NAFLD; conference poster (not a peer-reviewed journal). CohBar ceased operations in 2024.",
    },
  ],
};

async function main() {
  const compounds = await api(`/rest/v1/compounds?select=id,slug`);
  const idBySlug = new Map(compounds.map((c) => [c.slug, c.id]));

  let inserted = 0;
  for (const [slug, rows] of Object.entries(REFERENCES)) {
    const compoundId = idBySlug.get(slug);
    if (!compoundId) {
      console.warn(`  ! no compound for slug "${slug}" — skipping`);
      continue;
    }
    // Idempotent: clear existing references for this compound first.
    await api(`/rest/v1/compound_dose_reference?compound_id=eq.${compoundId}`, { method: "DELETE" });

    const payload = rows.map((r) => ({ ...r, compound_id: compoundId }));
    await api(`/rest/v1/compound_dose_reference`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    inserted += payload.length;
    console.log(`  ✓ ${slug}: ${payload.length} reference row(s)`);
  }
  console.log(`\n✓ seeded ${inserted} dose-reference rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
