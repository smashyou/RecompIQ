// Energy balance: BMR → TDEE → a daily calorie target and macro split.
//
// WHY THIS EXISTS: the product tracked calories but had nothing to compare them
// against. Protein was the only macro with a target, and it was captured once at
// onboarding and never revisited, so it kept pointing at the number that was
// right on day one. For a body-recomposition product the energy budget is the
// number everything else orbits.
//
// POSTURE — this is a computed educational target, not a prescription. It is the
// same class of output PRD §9 already sanctions for the coach ("nutrition target
// ranges: calories, protein, carbs, fat, fiber"), and every rendered target
// carries the clinician disclaimer like the existing protein band does. Nothing
// here is compound-aware and nothing adapts to a peptide protocol.
//
// EVIDENCE
//  • Mifflin-St Jeor (1990, Am J Clin Nutr 51:241-247) — the default resting-
//    energy equation in clinical practice; validated as the most accurate of the
//    predictive equations for non-obese AND obese adults by the Academy of
//    Nutrition and Dietetics evidence analysis (Frankenfield 2005, JADA
//    105:775-789). HUMAN_OBS tier: these are population regressions, and an
//    individual can sit ±10% off their predicted value.
//  • Katch-McArdle (1996) — 370 + 21.6 × lean mass kg. Preferred WHEN lean mass
//    is actually known, because it removes the fat-mass term that makes
//    weight-based equations drift for high-body-fat individuals. It is also
//    sex-independent, which is why it can still produce a number when sex is
//    unrecorded.
//  • Activity factors — the conventional Harris-Benedict/FAO PAL multipliers.
//    Mapped from MEASURED steps rather than a self-reported lifestyle label,
//    because the app has step data and self-report is the weakest input here.
//  • 3500 kcal per lb of fat (Wishnofsky 1958) — a documented approximation. It
//    overstates real long-run loss because it ignores metabolic adaptation and
//    the lean-mass fraction of weight lost; treat the derived rate as a planning
//    figure, not a promise. Kept because it is the transparent, checkable
//    convention users recognise.
//
// SAFETY RAILS (both tested)
//  1. The target rate is capped at MAX_LOSS_LB_PER_WEEK, which is deliberately
//     the same 2 lb/wk the alert engine's rapid_weight_loss rule warns at. The
//     app must never TARGET a pace it would then flag as unsafe.
//  2. The target is never allowed below BMR. When the requested timeline would
//     require it, the floor holds and `achievableLbPerWeek` reports the pace the
//     timeline actually supports — saying "this timeline needs more activity or
//     more weeks" is the useful answer; silently returning a sub-BMR number is
//     the harmful one.
// Insufficient inputs return null everywhere rather than a guessed number.

export const KCAL_PER_LB_FAT = 3500;

/** Same threshold as the alert engine's rapid_weight_loss warnAt — keep in sync. */
export const MAX_LOSS_LB_PER_WEEK = 2;

/** Additional cap: no more than this fraction of bodyweight per week. */
export const MAX_LOSS_FRACTION_PER_WEEK = 0.01;

const LB_PER_KG = 0.45359237;
const CM_PER_IN = 2.54;

export type BmrBasis = "katch-mcardle" | "mifflin-st-jeor";

export interface EnergyProfile {
  weightLb: number;
  heightIn?: number | null;
  ageYears?: number | null;
  /** `profiles.sex` — 'male' | 'female' | 'prefer_not_to_say' | null. */
  sex?: string | null;
  /** From a smart-scale sync (`weights.lean_mass_lb`), when present. */
  leanMassLb?: number | null;
  /** From a smart-scale sync (`weights.body_fat_pct`), when present. */
  bodyFatPct?: number | null;
}

/**
 * Lean mass from a body-fat percentage. Returns null outside a credible band —
 * a scale glitch reading 0% or 95% must not silently drive the whole target.
 */
export function leanMassFromBodyFat(
  weightLb: number,
  bodyFatPct: number | null | undefined,
): number | null {
  if (!(weightLb > 0)) return null;
  if (bodyFatPct === null || bodyFatPct === undefined) return null;
  if (!(bodyFatPct >= 3 && bodyFatPct <= 70)) return null;
  return weightLb * (1 - bodyFatPct / 100);
}

export interface BmrResult {
  kcal: number;
  basis: BmrBasis;
}

/**
 * Resting energy expenditure. Katch-McArdle when lean mass is known (directly or
 * via body fat %), otherwise Mifflin-St Jeor, which needs height, age and a
 * recorded sex. Returns null when neither can be computed.
 */
export function bmrKcal(p: EnergyProfile): BmrResult | null {
  if (!(p.weightLb > 0)) return null;

  const lean =
    p.leanMassLb && p.leanMassLb > 0
      ? p.leanMassLb
      : leanMassFromBodyFat(p.weightLb, p.bodyFatPct);

  // Preferred: no fat-mass term, and no sex constant needed.
  if (lean !== null && lean > 0) {
    return { kcal: 370 + 21.6 * (lean * LB_PER_KG), basis: "katch-mcardle" };
  }

  const sex = (p.sex ?? "").toLowerCase();
  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : null;
  if (sexConstant === null) return null; // 'prefer_not_to_say' / unset
  if (!(p.heightIn && p.heightIn > 0)) return null;
  if (!(p.ageYears && p.ageYears > 0)) return null;

  const kg = p.weightLb * LB_PER_KG;
  const cm = p.heightIn * CM_PER_IN;
  return {
    kcal: 10 * kg + 6.25 * cm - 5 * p.ageYears + sexConstant,
    basis: "mifflin-st-jeor",
  };
}

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
} as const;

export type ActivityLabel = keyof typeof ACTIVITY_FACTORS;

export interface ActivityResult {
  factor: number;
  label: ActivityLabel;
}

/**
 * Activity factor from MEASURED average daily steps.
 *
 * Returns null when there is no step data. Absent steps are not evidence of
 * being sedentary — treating "not logged" as "didn't happen" is exactly the trap
 * the adherence denominator fell into. Callers decide what to do with null and
 * must say so in the UI.
 */
export function palFromSteps(
  avgStepsPerDay: number | null | undefined,
): ActivityResult | null {
  if (avgStepsPerDay === null || avgStepsPerDay === undefined) return null;
  if (!Number.isFinite(avgStepsPerDay) || avgStepsPerDay < 0) return null;
  if (avgStepsPerDay < 5000) return { factor: ACTIVITY_FACTORS.sedentary, label: "sedentary" };
  if (avgStepsPerDay < 7500) return { factor: ACTIVITY_FACTORS.light, label: "light" };
  if (avgStepsPerDay < 12500) return { factor: ACTIVITY_FACTORS.moderate, label: "moderate" };
  return { factor: ACTIVITY_FACTORS.very, label: "very" };
}

export interface CappedRate {
  lbPerWeek: number;
  capped: boolean;
  reason: string;
}

/**
 * Clamp a requested loss rate to what the app is willing to target: the flat
 * 2 lb/wk the alert engine warns above, and 1% of bodyweight per week (which
 * binds first for lighter people).
 */
export function cappedLossRate(currentWeightLb: number, requestedLbPerWeek: number): CappedRate {
  if (requestedLbPerWeek <= 0) {
    return { lbPerWeek: requestedLbPerWeek, capped: false, reason: "" };
  }
  const fractionCap = currentWeightLb * MAX_LOSS_FRACTION_PER_WEEK;
  const cap = Math.min(MAX_LOSS_LB_PER_WEEK, fractionCap);
  if (requestedLbPerWeek <= cap) {
    return { lbPerWeek: requestedLbPerWeek, capped: false, reason: "" };
  }
  const reason =
    cap === fractionCap && fractionCap < MAX_LOSS_LB_PER_WEEK
      ? `capped at 1% of bodyweight per week (${cap.toFixed(1)} lb)`
      : `capped at ${MAX_LOSS_LB_PER_WEEK} lb per week — faster than this is the pace the app flags as rapid weight loss`;
  return { lbPerWeek: cap, capped: true, reason };
}

export interface CalorieTargetInput extends EnergyProfile {
  currentWeightLb: number;
  goalWeightLb: number;
  timelineWeeks: number;
  /** Measured average daily steps over a recent window, when available. */
  avgStepsPerDay?: number | null;
}

export interface CalorieTarget {
  bmrKcal: number;
  bmrBasis: BmrBasis;
  tdeeKcal: number;
  activityFactor: number;
  activityLabel: ActivityLabel;
  /** false → the factor was assumed (sedentary), not derived from step data. */
  activityMeasured: boolean;
  /** Signed: positive is a deficit, negative is a surplus. */
  deficitKcal: number;
  targetKcal: number;
  lowKcal: number;
  highKcal: number;
  /** The rate the target is built on, after capping. */
  lbPerWeek: number;
  rateCapped: boolean;
  rateCapReason: string;
  /** True when the BMR floor bound and the target was raised to meet it. */
  floored: boolean;
  /** The pace this target actually supports — differs from lbPerWeek when floored. */
  achievableLbPerWeek: number;
}

/** ±5% band, so the number reads as the estimate it is rather than a precise instruction. */
const BAND = 0.05;

export function calorieTarget(input: CalorieTargetInput): CalorieTarget | null {
  const bmr = bmrKcal({ ...input, weightLb: input.currentWeightLb });
  if (!bmr) return null;
  if (!(input.timelineWeeks > 0)) return null;

  const measured = palFromSteps(input.avgStepsPerDay);
  const activity = measured ?? { factor: ACTIVITY_FACTORS.sedentary, label: "sedentary" as const };
  const tdee = bmr.kcal * activity.factor;

  const lbToLose = input.currentWeightLb - input.goalWeightLb;
  const requestedRate = lbToLose / input.timelineWeeks;

  let rate = requestedRate;
  let capped = false;
  let capReason = "";
  if (requestedRate > 0) {
    const c = cappedLossRate(input.currentWeightLb, requestedRate);
    rate = c.lbPerWeek;
    capped = c.capped;
    capReason = c.reason;
  }

  const deficit = (rate * KCAL_PER_LB_FAT) / 7;
  const rawTarget = tdee - deficit;

  // Rail 2: never below BMR.
  const floored = rawTarget < bmr.kcal;
  const target = floored ? bmr.kcal : rawTarget;
  const effectiveDeficit = tdee - target;
  const achievableLbPerWeek = (effectiveDeficit * 7) / KCAL_PER_LB_FAT;

  return {
    bmrKcal: bmr.kcal,
    bmrBasis: bmr.basis,
    tdeeKcal: tdee,
    activityFactor: activity.factor,
    activityLabel: activity.label,
    activityMeasured: measured !== null,
    deficitKcal: effectiveDeficit,
    targetKcal: target,
    lowKcal: target * (1 - BAND),
    highKcal: target * (1 + BAND),
    lbPerWeek: rate,
    rateCapped: capped,
    rateCapReason: capReason,
    floored,
    achievableLbPerWeek,
  };
}

export interface MacroTargets {
  proteinGMin: number;
  proteinGMax: number;
  fatGMin: number;
  fatGMax: number;
  carbGMin: number;
  carbGMax: number;
}

const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;

/**
 * Split a calorie target into macros. Protein comes in from the existing
 * goal-aware band (see ./protein) rather than being recomputed here. Fat uses
 * the IOM Acceptable Macronutrient Distribution Range of 20-35% of energy;
 * carbohydrate takes the remainder and floors at zero rather than going negative
 * when a high-protein target meets a small calorie budget.
 */
export function macroTargets(
  targetKcal: number,
  protein: { proteinGMin: number; proteinGMax: number },
): MacroTargets {
  const fatGMin = (targetKcal * 0.2) / KCAL_PER_G.fat;
  const fatGMax = (targetKcal * 0.35) / KCAL_PER_G.fat;

  const proteinKcalMid =
    ((protein.proteinGMin + protein.proteinGMax) / 2) * KCAL_PER_G.protein;

  // Carbs are what's left. Pair the low-carb end with the HIGH fat end.
  const carbKcalMin = targetKcal - proteinKcalMid - fatGMax * KCAL_PER_G.fat;
  const carbKcalMax = targetKcal - proteinKcalMid - fatGMin * KCAL_PER_G.fat;

  return {
    proteinGMin: protein.proteinGMin,
    proteinGMax: protein.proteinGMax,
    fatGMin,
    fatGMax,
    carbGMin: Math.max(0, carbKcalMin / KCAL_PER_G.carb),
    carbGMax: Math.max(0, carbKcalMax / KCAL_PER_G.carb),
  };
}
