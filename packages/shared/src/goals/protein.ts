// Goal-aware daily protein target defaults.
//
// Protein needs differ by body-composition goal, so the onboarding auto-fill
// keys off the user's weight-goal DIRECTION (start vs goal weight) rather than a
// single flat coefficient. Values are g/lb of TOTAL bodyweight (the app only
// knows total weight at onboarding, not lean mass) and are bounded by the
// 20–400 g/day clamp, which also caps over-anchoring for individuals with
// obesity (per-total-weight overstates need vs per-LBM).
//
// Evidence (HUMAN_RCT tier — these are educational defaults, NOT prescriptions;
// every rendered target carries the clinician disclaimer):
//   • loss — fat loss in an energy deficit, incl. GLP-1 / incretin therapy
//     (semaglutide/tirzepatide/retatrutide), where lean-mass loss is a known
//     concern. Kept at the product's established 0.6–0.8 g/lb (≈1.3–1.8 g/kg) —
//     defensible and muscle-sparing; the GLP-1 lean-mass-preservation consensus
//     sits ~1.2–1.6 g/kg (LEAN-PREP RCT protocol targets 1.6 g/kg) and the
//     obesity-pharmacotherapy reviews recommend 1.0–1.4 g/kg. Anchored to total
//     weight, conservative for high-BF users.
//   • gain — muscle gain / hypertrophy in a surplus. Morton 2018 BJSM
//     meta-analysis (49 RCTs, n=1863): FFM-gain plateau at 1.62 g/kg, upper 95%
//     CI 2.2 g/kg → ~0.73–1.0 g/lb. Strongest evidence tier in sports nutrition.
//   • maintain — body recomposition / weight maintenance. ≥2.2 g/kg with
//     resistance training (Barakat 2020; Morton 2018) → ~0.7–1.0 g/lb.
// Sources: ISSN Position Stand 2017 (PMC5477153); Morton et al. 2018 BJSM;
// Helms et al. 2014; Barakat et al. 2020 (NSCA-SCJ); LEAN-PREP protocol
// (PMC13110620); obesity-pharmacotherapy review (PMC12157928).

export type ProteinGoalDirection = "loss" | "gain" | "maintain";

export interface ProteinBand {
  /** g/lb of total bodyweight — low end of the suggested range. */
  minGPerLb: number;
  /** g/lb of total bodyweight — high end of the suggested range. */
  maxGPerLb: number;
  /** Short label for the goal context, e.g. "muscle gain". */
  label: string;
}

export const PROTEIN_BANDS: Record<ProteinGoalDirection, ProteinBand> = {
  loss: { minGPerLb: 0.6, maxGPerLb: 0.8, label: "fat loss" },
  gain: { minGPerLb: 0.8, maxGPerLb: 1.0, label: "muscle gain" },
  maintain: { minGPerLb: 0.7, maxGPerLb: 1.0, label: "recomposition" },
};

// Below this fractional change between start and goal weight we treat the goal
// as maintenance / recomposition rather than a clear cut or bulk.
const MAINTENANCE_BAND = 0.02;

/**
 * Infer the protein goal direction from start vs goal weight. With no goal
 * weight yet, default to "loss" — the app's primary fat-loss / GLP-1 use case.
 */
export function proteinDirection(
  startWeightLb: number,
  goalWeightLb: number | null | undefined,
): ProteinGoalDirection {
  if (!(startWeightLb > 0) || !goalWeightLb || !(goalWeightLb > 0)) return "loss";
  const pct = (goalWeightLb - startWeightLb) / startWeightLb;
  if (pct >= MAINTENANCE_BAND) return "gain";
  if (pct <= -MAINTENANCE_BAND) return "loss";
  return "maintain";
}

/** Clamp to the Zod-enforced 20–400 g/day bound so extreme inputs can't break submission. */
export function clampProtein(g: number): number {
  return Math.min(400, Math.max(20, Math.round(g)));
}

/**
 * Suggested daily protein range (grams) for a given start weight + goal
 * direction. Returns the chosen band so callers can show the g/lb basis + label.
 */
export function proteinTargetGrams(
  startWeightLb: number,
  direction: ProteinGoalDirection,
): { low: number; high: number; band: ProteinBand } {
  const band = PROTEIN_BANDS[direction];
  return {
    low: clampProtein(startWeightLb * band.minGPerLb),
    high: clampProtein(startWeightLb * band.maxGPerLb),
    band,
  };
}

/** Convenience: midpoint of a goal weight range, or null if unavailable. */
export function goalWeightMidpoint(
  goalMin: number | null | undefined,
  goalMax: number | null | undefined,
): number | null {
  const lo = Number(goalMin);
  const hi = Number(goalMax);
  const valid = [lo, hi].filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
