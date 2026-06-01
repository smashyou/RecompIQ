// Lab marker catalog (REGIMEN_GOALS_PRD §4.4). Canonical biomarker definitions
// used to: (1) normalize OCR'd marker names → a stable key, (2) supply a
// fallback reference range when a report doesn't print one or the user enters a
// value manually, (3) drive in/out-of-range highlighting and trend direction.
//
// IMPORTANT — these are TYPICAL adult reference ranges for educational display
// only. Real reference ranges vary by lab, assay, age, sex, and pregnancy. The
// app flags values outside a range; it never interprets them or gives medical
// advice. The report's own printed range always wins over the catalog range.

export type LabPanel =
  | "metabolic"
  | "lipids"
  | "cbc"
  | "cmp"
  | "thyroid"
  | "hormones"
  | "inflammation"
  | "vitamins"
  | "other";

/** Which direction is generally considered favorable, for trend coloring only. */
export type OptimalDirection = "low" | "high" | "mid";

export interface LabMarkerDef {
  key: string;
  label: string;
  panel: LabPanel;
  /** Canonical conventional (US) unit. */
  unit: string;
  /** Typical adult reference range (conventional units). null = no simple range. */
  refLow: number | null;
  refHigh: number | null;
  /** Favorable direction (display/trend only — not a diagnostic claim). */
  optimal: OptimalDirection;
  /** Display precision. */
  decimals: number;
  /** Lower-cased alias fragments used to map OCR'd / typed names → this key. */
  aliases: string[];
  /** Reference range meaningfully differs by sex — the combined catalog range
   *  can mislead, so the UI must caveat it when no report range is present. */
  sexSpecific?: boolean;
}

export const LAB_MARKER_DEFS: LabMarkerDef[] = [
  // ── Metabolic ──────────────────────────────────────────────────────────
  { key: "hba1c", label: "Hemoglobin A1c", panel: "metabolic", unit: "%", refLow: 4.0, refHigh: 5.6, optimal: "low", decimals: 1, aliases: ["hba1c", "hemoglobin a1c", "a1c", "glycated hemoglobin", "glycohemoglobin"] },
  { key: "glucose_fasting", label: "Glucose (fasting)", panel: "metabolic", unit: "mg/dL", refLow: 70, refHigh: 99, optimal: "mid", decimals: 0, aliases: ["glucose", "fasting glucose", "glucose fasting", "blood sugar", "glu"] },
  { key: "insulin_fasting", label: "Insulin (fasting)", panel: "metabolic", unit: "µIU/mL", refLow: 2.0, refHigh: 19.6, optimal: "low", decimals: 1, aliases: ["insulin", "fasting insulin"] },

  // ── Lipid panel ────────────────────────────────────────────────────────
  { key: "total_cholesterol", label: "Total cholesterol", panel: "lipids", unit: "mg/dL", refLow: 100, refHigh: 199, optimal: "low", decimals: 0, aliases: ["total cholesterol", "cholesterol total", "cholesterol, total", "chol"] },
  { key: "ldl", label: "LDL cholesterol", panel: "lipids", unit: "mg/dL", refLow: 0, refHigh: 99, optimal: "low", decimals: 0, aliases: ["ldl", "ldl-c", "ldl cholesterol", "ldl calc", "ldl chol calc"] },
  { key: "hdl", label: "HDL cholesterol", panel: "lipids", unit: "mg/dL", refLow: 40, refHigh: 100, optimal: "high", decimals: 0, aliases: ["hdl", "hdl-c", "hdl cholesterol"] },
  { key: "triglycerides", label: "Triglycerides", panel: "lipids", unit: "mg/dL", refLow: 0, refHigh: 149, optimal: "low", decimals: 0, aliases: ["triglycerides", "triglyceride", "trig", "tg"] },
  { key: "non_hdl", label: "Non-HDL cholesterol", panel: "lipids", unit: "mg/dL", refLow: 0, refHigh: 129, optimal: "low", decimals: 0, aliases: ["non hdl", "non-hdl", "non hdl cholesterol"] },

  // ── CBC ────────────────────────────────────────────────────────────────
  { key: "wbc", label: "White blood cells", panel: "cbc", unit: "10³/µL", refLow: 3.4, refHigh: 10.8, optimal: "mid", decimals: 1, aliases: ["wbc", "white blood cell", "white blood cells", "leukocytes"] },
  { key: "rbc", label: "Red blood cells", panel: "cbc", unit: "10⁶/µL", refLow: 4.2, refHigh: 5.8, optimal: "mid", decimals: 2, aliases: ["rbc", "red blood cell", "red blood cells"] },
  { key: "hemoglobin", label: "Hemoglobin", panel: "cbc", unit: "g/dL", refLow: 12.0, refHigh: 17.0, optimal: "mid", decimals: 1, aliases: ["hemoglobin", "hgb", "hb"], sexSpecific: true },
  { key: "hematocrit", label: "Hematocrit", panel: "cbc", unit: "%", refLow: 37, refHigh: 50, optimal: "mid", decimals: 1, aliases: ["hematocrit", "hct"], sexSpecific: true },
  { key: "platelets", label: "Platelets", panel: "cbc", unit: "10³/µL", refLow: 150, refHigh: 400, optimal: "mid", decimals: 0, aliases: ["platelet", "platelets", "plt", "platelet count"] },
  { key: "mcv", label: "MCV", panel: "cbc", unit: "fL", refLow: 79, refHigh: 97, optimal: "mid", decimals: 1, aliases: ["mcv", "mean corpuscular volume"] },

  // ── CMP / electrolytes / kidney / liver ──────────────────────────────────
  { key: "sodium", label: "Sodium", panel: "cmp", unit: "mmol/L", refLow: 134, refHigh: 144, optimal: "mid", decimals: 0, aliases: ["sodium", "na"] },
  { key: "potassium", label: "Potassium", panel: "cmp", unit: "mmol/L", refLow: 3.5, refHigh: 5.2, optimal: "mid", decimals: 1, aliases: ["potassium", "k"] },
  { key: "chloride", label: "Chloride", panel: "cmp", unit: "mmol/L", refLow: 96, refHigh: 106, optimal: "mid", decimals: 0, aliases: ["chloride", "cl"] },
  { key: "co2", label: "CO₂ (bicarbonate)", panel: "cmp", unit: "mmol/L", refLow: 20, refHigh: 29, optimal: "mid", decimals: 0, aliases: ["co2", "carbon dioxide", "bicarbonate", "hco3"] },
  { key: "bun", label: "BUN", panel: "cmp", unit: "mg/dL", refLow: 7, refHigh: 25, optimal: "mid", decimals: 0, aliases: ["bun", "urea nitrogen", "blood urea nitrogen"] },
  { key: "creatinine", label: "Creatinine", panel: "cmp", unit: "mg/dL", refLow: 0.6, refHigh: 1.3, optimal: "mid", decimals: 2, aliases: ["creatinine", "creat"] },
  { key: "egfr", label: "eGFR", panel: "cmp", unit: "mL/min/1.73", refLow: 60, refHigh: 120, optimal: "high", decimals: 0, aliases: ["egfr", "gfr", "estimated gfr", "glomerular filtration"] },
  { key: "calcium", label: "Calcium", panel: "cmp", unit: "mg/dL", refLow: 8.6, refHigh: 10.3, optimal: "mid", decimals: 1, aliases: ["calcium", "ca"] },
  { key: "total_protein", label: "Total protein", panel: "cmp", unit: "g/dL", refLow: 6.0, refHigh: 8.3, optimal: "mid", decimals: 1, aliases: ["total protein", "protein total", "protein, total"] },
  { key: "albumin", label: "Albumin", panel: "cmp", unit: "g/dL", refLow: 3.5, refHigh: 5.0, optimal: "mid", decimals: 1, aliases: ["albumin"] },
  { key: "bilirubin_total", label: "Bilirubin (total)", panel: "cmp", unit: "mg/dL", refLow: 0.2, refHigh: 1.2, optimal: "low", decimals: 1, aliases: ["bilirubin", "total bilirubin", "bilirubin total", "bilirubin, total", "t bili"] },
  { key: "alp", label: "Alkaline phosphatase", panel: "cmp", unit: "U/L", refLow: 40, refHigh: 129, optimal: "mid", decimals: 0, aliases: ["alkaline phosphatase", "alp", "alk phos"] },
  { key: "ast", label: "AST", panel: "cmp", unit: "U/L", refLow: 10, refHigh: 40, optimal: "low", decimals: 0, aliases: ["ast", "aspartate aminotransferase", "sgot"] },
  { key: "alt", label: "ALT", panel: "cmp", unit: "U/L", refLow: 9, refHigh: 46, optimal: "low", decimals: 0, aliases: ["alt", "alanine aminotransferase", "sgpt"] },

  // ── Thyroid ──────────────────────────────────────────────────────────────
  { key: "tsh", label: "TSH", panel: "thyroid", unit: "mIU/L", refLow: 0.45, refHigh: 4.5, optimal: "mid", decimals: 2, aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin"] },
  { key: "free_t4", label: "Free T4", panel: "thyroid", unit: "ng/dL", refLow: 0.82, refHigh: 1.77, optimal: "mid", decimals: 2, aliases: ["free t4", "ft4", "t4 free", "free thyroxine"] },

  // ── Hormones ─────────────────────────────────────────────────────────────
  { key: "testosterone_total", label: "Testosterone (total)", panel: "hormones", unit: "ng/dL", refLow: 264, refHigh: 916, optimal: "mid", decimals: 0, aliases: ["testosterone", "total testosterone", "testosterone total", "testosterone, total"], sexSpecific: true },

  // ── Inflammation ─────────────────────────────────────────────────────────
  { key: "hs_crp", label: "hs-CRP", panel: "inflammation", unit: "mg/L", refLow: 0, refHigh: 3.0, optimal: "low", decimals: 1, aliases: ["hs-crp", "hscrp", "high sensitivity crp", "c-reactive protein", "crp"] },
  { key: "uric_acid", label: "Uric acid", panel: "inflammation", unit: "mg/dL", refLow: 3.5, refHigh: 7.2, optimal: "low", decimals: 1, aliases: ["uric acid", "urate"] },

  // ── Vitamins ─────────────────────────────────────────────────────────────
  { key: "vitamin_d", label: "Vitamin D (25-OH)", panel: "vitamins", unit: "ng/mL", refLow: 30, refHigh: 100, optimal: "high", decimals: 1, aliases: ["vitamin d", "25-hydroxyvitamin d", "25 oh vitamin d", "vit d", "25-oh vitamin d"] },
  { key: "vitamin_b12", label: "Vitamin B12", panel: "vitamins", unit: "pg/mL", refLow: 232, refHigh: 1245, optimal: "mid", decimals: 0, aliases: ["vitamin b12", "b12", "cobalamin"] },
  { key: "ferritin", label: "Ferritin", panel: "vitamins", unit: "ng/mL", refLow: 30, refHigh: 400, optimal: "mid", decimals: 0, aliases: ["ferritin"] },
];

export const LAB_MARKER_BY_KEY: Record<string, LabMarkerDef> = Object.fromEntries(
  LAB_MARKER_DEFS.map((m) => [m.key, m]),
);

export const LAB_MARKER_KEYS = LAB_MARKER_DEFS.map((m) => m.key) as [string, ...string[]];

export const LAB_PANELS: LabPanel[] = [
  "metabolic",
  "lipids",
  "cbc",
  "cmp",
  "thyroid",
  "hormones",
  "inflammation",
  "vitamins",
  "other",
];

export const LAB_PANEL_LABEL: Record<LabPanel, string> = {
  metabolic: "Metabolic",
  lipids: "Lipid panel",
  cbc: "Complete blood count",
  cmp: "Comprehensive metabolic panel",
  thyroid: "Thyroid",
  hormones: "Hormones",
  inflammation: "Inflammation",
  vitamins: "Vitamins & minerals",
  other: "Other",
};

/**
 * Best-effort normalize a free-text marker name (from OCR or manual entry) to a
 * catalog key. Returns null when nothing matches (the raw name is still kept).
 */
export function matchMarkerKey(rawName: string): string | null {
  const norm = rawName.trim().toLowerCase().replace(/[.,;:()]/g, " ").replace(/\s+/g, " ").trim();
  if (!norm) return null;
  // Exact key or label hit first.
  for (const def of LAB_MARKER_DEFS) {
    if (def.key === norm || def.label.toLowerCase() === norm) return def.key;
  }
  // Exact alias match.
  for (const def of LAB_MARKER_DEFS) {
    if (def.aliases.includes(norm)) return def.key;
  }
  // Token-aware substring match (longest alias wins to avoid "crp" eating "hs-crp").
  let best: { key: string; len: number } | null = null;
  for (const def of LAB_MARKER_DEFS) {
    for (const alias of def.aliases) {
      if ((norm === alias || norm.includes(alias)) && (!best || alias.length > best.len)) {
        best = { key: def.key, len: alias.length };
      }
    }
  }
  return best?.key ?? null;
}

/** in / low / high relative to a range (report range preferred, catalog fallback). */
export type RangeStatus = "in" | "low" | "high" | "unknown";

export function rangeStatus(
  value: number,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
): RangeStatus {
  const lo = refLow ?? null;
  const hi = refHigh ?? null;
  if (lo == null && hi == null) return "unknown";
  if (lo != null && value < lo) return "low";
  if (hi != null && value > hi) return "high";
  return "in";
}

/** Resolve the effective range for a marker: report-printed range wins, else catalog. */
export function effectiveRange(
  markerKey: string | null | undefined,
  reportLow: number | null | undefined,
  reportHigh: number | null | undefined,
): { low: number | null; high: number | null; source: "report" | "catalog" | "none" } {
  if (reportLow != null || reportHigh != null) {
    return { low: reportLow ?? null, high: reportHigh ?? null, source: "report" };
  }
  const def = markerKey ? LAB_MARKER_BY_KEY[markerKey] : undefined;
  if (def && (def.refLow != null || def.refHigh != null)) {
    return { low: def.refLow, high: def.refHigh, source: "catalog" };
  }
  return { low: null, high: null, source: "none" };
}
