// Metric catalog (REGIMEN_GOALS_PRD §4.3/§5.6). Canonical goal-tracking metrics
// surfaced in quick-log per the user's active goals. Subjective 1–10 self-ratings
// + circumference. Objective cognition-test metrics are written by the mini-test,
// not logged via a slider. All values are user self-reports — never clinical.

import { type GoalKey } from "./taxonomy";

export type MetricKind = "rating" | "circumference" | "objective";

export interface MetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  unit: string; // 'rating' | 'cm' | 'ms' | 'score'
  min: number;
  max: number;
  /** Higher value = better outcome (true) vs lower = better (false, e.g. pain). */
  higherIsBetter: boolean;
  hint?: string;
  /** Optional 0–10 anchor example sentences for self-checks (value → relatable text). */
  anchors?: { value: number; label: string }[];
}

export const METRIC_DEFS: MetricDef[] = [
  { key: "skin_quality", label: "Skin quality", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "focus", label: "Focus / clarity", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "energy", label: "Energy", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "libido", label: "Libido", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "mood", label: "Mood", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "sleep_quality", label: "Sleep quality", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "pain_level", label: "Pain", kind: "rating", unit: "rating", min: 0, max: 10, higherIsBetter: false, hint: "0 = none, 10 = worst" },
  { key: "mobility", label: "Mobility / ROM", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "gi_comfort", label: "Gut comfort", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "hair_density", label: "Hair density", kind: "rating", unit: "rating", min: 1, max: 10, higherIsBetter: true },
  { key: "waist_cm", label: "Waist", kind: "circumference", unit: "cm", min: 30, max: 200, higherIsBetter: false },
  { key: "arm_cm", label: "Arm", kind: "circumference", unit: "cm", min: 15, max: 80, higherIsBetter: true },
  { key: "neuro_severity", label: "Nerve symptoms", kind: "rating", unit: "rating", min: 0, max: 10, higherIsBetter: false,
    anchors: [
      { value: 0, label: "No numbness or weakness." },
      { value: 3, label: "Mild tingling on long walks (my usual)." },
      { value: 6, label: "Numb most of the day; foot feels heavy." },
      { value: 9, label: "Can't feel my foot, or it gives out / new weakness." },
    ] },
  { key: "nausea_severity", label: "Nausea", kind: "rating", unit: "rating", min: 0, max: 10, higherIsBetter: false,
    anchors: [
      { value: 0, label: "No nausea." },
      { value: 3, label: "Slight queasiness." },
      { value: 6, label: "Nauseous much of the day; eating is hard." },
      { value: 9, label: "Vomiting or can't keep fluids down." },
    ] },
  // Objective cognition-test outputs (written by the mini-test, not a slider).
  { key: "cognition_reaction_ms", label: "Reaction time", kind: "objective", unit: "ms", min: 100, max: 1500, higherIsBetter: false },
  { key: "cognition_memory_score", label: "Memory span", kind: "objective", unit: "score", min: 0, max: 12, higherIsBetter: true },
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  METRIC_DEFS.map((m) => [m.key, m]),
);

export const METRIC_KEYS = METRIC_DEFS.map((m) => m.key) as [string, ...string[]];

// Which quick-log metric keys each goal surfaces (sliders + circumference).
// Objective cognition metrics come from the mini-test, surfaced under cognition.
export const GOAL_METRIC_KEYS: Record<GoalKey, string[]> = {
  fat_loss: ["waist_cm"],
  muscle_gain: ["arm_cm"],
  injury_recovery: ["pain_level", "mobility"],
  skin_quality: ["skin_quality"],
  hair: ["hair_density"],
  cognition: ["focus"],
  longevity: ["energy", "sleep_quality"],
  energy: ["energy"],
  sleep: ["sleep_quality"],
  immune: ["energy"],
  libido: ["libido"],
  gut: ["gi_comfort"],
  mood: ["mood"],
};

/** Distinct quick-log metric keys for a set of active goals (order-stable). */
export function metricsForGoals(goalKeys: GoalKey[]): MetricDef[] {
  const seen = new Set<string>();
  const out: MetricDef[] = [];
  for (const g of goalKeys) {
    for (const k of GOAL_METRIC_KEYS[g] ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      const def = METRIC_BY_KEY[k];
      if (def) out.push(def);
    }
  }
  return out;
}
