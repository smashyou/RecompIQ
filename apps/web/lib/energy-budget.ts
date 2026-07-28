// Assembles the daily energy budget from rows the caller already fetched.
//
// No IO on purpose. The dashboard loads profile / weights / steps / goal as part
// of its big parallel read and the food page fetches a smaller set, so a shared
// LOADER would either duplicate queries or force one caller into the other's
// shape. Sharing the assembly instead keeps a single definition of the budget
// while each surface fetches what suits it — and stops the two drifting apart.

import {
  calorieTarget,
  macroTargets,
  type CalorieTarget,
  type MacroTargets,
} from "@peptide/shared/goals/energy";

export interface EnergyBudget {
  energy: CalorieTarget | null;
  macros: MacroTargets | null;
}

export interface EnergyBudgetRows {
  profile: { dob?: string | null; sex?: string | null; height_in?: number | string | null } | null;
  /** The most recent weigh-in — body composition columns are optional. */
  latestWeight: {
    value_lb: number | string;
    body_fat_pct?: number | string | null;
    lean_mass_lb?: number | string | null;
  } | null;
  goal: {
    goal_weight_lb_min: number | string;
    goal_weight_lb_max: number | string;
    timeline_weeks: number | string;
    protein_target_g_min: number | string;
    protein_target_g_max: number | string;
  } | null;
  /** Mean of the LOGGED step days in the window, or null when none were logged. */
  avgStepsPerDay: number | null;
}

/** Whole years elapsed since an ISO date, for the BMR age term. */
export function yearsSince(isoDate: string): number | null {
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - then.getFullYear();
  const m = now.getMonth() - then.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < then.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export function buildEnergyBudget(rows: EnergyBudgetRows): EnergyBudget {
  const weightLb = num(rows.latestWeight?.value_lb);
  const goal = rows.goal;
  if (weightLb === null || !goal) return { energy: null, macros: null };

  const goalMid =
    (Number(goal.goal_weight_lb_min) + Number(goal.goal_weight_lb_max)) / 2;

  const dob = rows.profile?.dob;
  const energy = calorieTarget({
    // Built off the LATEST weigh-in, not the onboarding start weight, so the
    // budget tracks the body it describes instead of freezing on day one.
    weightLb,
    currentWeightLb: weightLb,
    goalWeightLb: goalMid,
    timelineWeeks: Number(goal.timeline_weeks),
    heightIn: num(rows.profile?.height_in),
    ageYears: dob ? yearsSince(dob) : null,
    sex: rows.profile?.sex ?? null,
    bodyFatPct: num(rows.latestWeight?.body_fat_pct),
    leanMassLb: num(rows.latestWeight?.lean_mass_lb),
    avgStepsPerDay: rows.avgStepsPerDay,
  });

  const macros = energy
    ? macroTargets(energy.targetKcal, {
        proteinGMin: Number(goal.protein_target_g_min),
        proteinGMax: Number(goal.protein_target_g_max),
      })
    : null;

  return { energy, macros };
}

/** Mean of the logged step days; null when nothing was logged in the window. */
export function averageSteps(rows: Array<{ count: number | string }> | null | undefined): number | null {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((s, r) => s + Number(r.count), 0) / rows.length;
}
