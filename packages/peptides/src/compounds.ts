import type { EvidenceLevel } from "@peptide/shared";

export interface Compound {
  slug: string;
  name: string;
  aliases: string[];
  category: "incretin" | "growth_factor" | "tissue_repair" | "metabolic" | "longevity" | "other";
  evidenceLevel: EvidenceLevel;
  fdaApproved: boolean;
  shortDescription: string;
}

// Seed list for the catalog. Detailed evidence + monitoring + contraindication
// data lives in db/seeds/compounds.sql once Phase 6 lands.
export const SEED_COMPOUNDS: ReadonlyArray<Compound> = [
  {
    slug: "retatrutide",
    name: "Retatrutide",
    aliases: ["LY3437943"],
    category: "incretin",
    evidenceLevel: "HUMAN_RCT",
    fdaApproved: false,
    shortDescription: "Triple-agonist (GLP-1/GIP/glucagon) investigational for obesity.",
  },
  {
    slug: "aod-9604",
    name: "AOD-9604",
    aliases: ["Anti-Obesity Drug 9604", "AOD9604"],
    category: "metabolic",
    evidenceLevel: "HUMAN_OBS",
    fdaApproved: false,
    shortDescription: "Modified C-terminal fragment of hGH studied for adipose breakdown.",
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    aliases: ["Copper Peptide"],
    category: "tissue_repair",
    evidenceLevel: "HUMAN_OBS",
    fdaApproved: false,
    shortDescription: "Copper tripeptide investigated for skin and tissue repair.",
  },
  {
    slug: "bpc-157",
    name: "BPC-157",
    aliases: ["Body Protection Compound"],
    category: "tissue_repair",
    evidenceLevel: "ANIMAL",
    fdaApproved: false,
    shortDescription: "Synthetic peptide derived from gastric protein; tissue repair research.",
  },
  {
    slug: "tb-500",
    name: "TB-500",
    aliases: ["Thymosin Beta-4 fragment"],
    category: "tissue_repair",
    evidenceLevel: "ANIMAL",
    fdaApproved: false,
    shortDescription: "Thymosin beta-4 derivative; investigated for tissue regeneration.",
  },
  {
    slug: "kpv",
    name: "KPV",
    aliases: ["Lysine-Proline-Valine"],
    category: "tissue_repair",
    evidenceLevel: "ANIMAL",
    fdaApproved: false,
    shortDescription: "α-MSH C-terminal tripeptide; anti-inflammatory research.",
  },
  {
    slug: "mots-c",
    name: "MOTS-C",
    aliases: ["Mitochondrial Open Reading Frame of 12S rRNA Type-C"],
    category: "longevity",
    evidenceLevel: "ANIMAL",
    fdaApproved: false,
    shortDescription: "Mitochondrial-derived peptide studied for metabolic regulation.",
  },
  {
    slug: "nad-plus",
    name: "NAD+",
    aliases: ["Nicotinamide Adenine Dinucleotide"],
    category: "longevity",
    evidenceLevel: "HUMAN_OBS",
    fdaApproved: false,
    shortDescription: "Coenzyme studied for energy metabolism and longevity.",
  },
];

export type CompoundSlug = (typeof SEED_COMPOUNDS)[number]["slug"];
