import {
  GOAL_BY_KEY,
  METRIC_BY_KEY,
  projectionRateFor,
  type GoalKey,
} from "@peptide/shared";
import { buildMetricProjection } from "@peptide/projections";
import { supabase } from "@/lib/supabase";

export interface GoalCardData {
  goalKey: string;
  goalLabel: string;
  metricLabel: string;
  unit: string;
  higherIsBetter: boolean;
  current: number | null;
  observedPerWeek: number | null;
  points: { date: string; value: number }[];
  projection: { targetValue: number; weeks: number; evidenceLevel: string; citation: string; caveat: string } | null;
}

const PRIMARY: Partial<
  Record<GoalKey, { metricKey: string; source: "goal_metrics" | "lean"; higherIsBetter: boolean; label: string; unit: string }>
> = {
  fat_loss: { metricKey: "waist_cm", source: "goal_metrics", higherIsBetter: false, label: "Waist", unit: "cm" },
  muscle_gain: { metricKey: "lean_mass_lb", source: "lean", higherIsBetter: true, label: "Lean mass", unit: "lb" },
  skin_quality: { metricKey: "skin_quality", source: "goal_metrics", higherIsBetter: true, label: "Skin quality", unit: "/10" },
  injury_recovery: { metricKey: "pain_level", source: "goal_metrics", higherIsBetter: false, label: "Pain", unit: "/10" },
  hair: { metricKey: "hair_density", source: "goal_metrics", higherIsBetter: true, label: "Hair density", unit: "/10" },
  cognition: { metricKey: "focus", source: "goal_metrics", higherIsBetter: true, label: "Focus", unit: "/10" },
  energy: { metricKey: "energy", source: "goal_metrics", higherIsBetter: true, label: "Energy", unit: "/10" },
  sleep: { metricKey: "sleep_quality", source: "goal_metrics", higherIsBetter: true, label: "Sleep quality", unit: "/10" },
  libido: { metricKey: "libido", source: "goal_metrics", higherIsBetter: true, label: "Libido", unit: "/10" },
  gut: { metricKey: "gi_comfort", source: "goal_metrics", higherIsBetter: true, label: "Gut comfort", unit: "/10" },
  mood: { metricKey: "mood", source: "goal_metrics", higherIsBetter: true, label: "Mood", unit: "/10" },
  longevity: { metricKey: "energy", source: "goal_metrics", higherIsBetter: true, label: "Energy", unit: "/10" },
  immune: { metricKey: "energy", source: "goal_metrics", higherIsBetter: true, label: "Energy", unit: "/10" },
};

export async function loadGoalCards(userId: string): Promise<GoalCardData[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [{ data: goals }, { data: metrics }, { data: weights }] = await Promise.all([
    supabase.from("user_goals").select("goal_key,priority").eq("user_id", userId).order("priority"),
    supabase
      .from("goal_metrics")
      .select("metric_key,value,logged_at")
      .eq("user_id", userId)
      .gte("logged_at", ninetyDaysAgo)
      .order("logged_at", { ascending: true }),
    supabase
      .from("weights")
      .select("logged_at,lean_mass_lb")
      .eq("user_id", userId)
      .not("lean_mass_lb", "is", null)
      .order("logged_at", { ascending: true }),
  ]);

  const byMetric = new Map<string, { date: string; value: number }[]>();
  for (const m of (metrics ?? []) as any[]) {
    const arr = byMetric.get(m.metric_key) ?? [];
    arr.push({ date: String(m.logged_at).slice(0, 10), value: Number(m.value) });
    byMetric.set(m.metric_key, arr);
  }
  const lean = ((weights ?? []) as any[]).map((w) => ({ date: String(w.logged_at).slice(0, 10), value: Number(w.lean_mass_lb) }));

  const cards: GoalCardData[] = [];
  for (const g of (goals ?? []) as any[]) {
    const goalKey = g.goal_key as GoalKey;
    const def = PRIMARY[goalKey];
    if (!def) continue;
    const series = def.source === "lean" ? lean : byMetric.get(def.metricKey) ?? [];
    const rate = projectionRateFor(def.metricKey);
    const ratingDef = METRIC_BY_KEY[def.metricKey];
    const proj = buildMetricProjection(series, {
      higherIsBetter: def.higherIsBetter,
      expectedRatePerWeek: rate?.perWeek ?? null,
      evidenceLevel: rate?.evidenceLevel ?? null,
      horizonWeeks: rate?.horizonWeeks,
      clampMin: ratingDef?.kind === "rating" ? ratingDef.min : undefined,
      clampMax: ratingDef?.kind === "rating" ? ratingDef.max : undefined,
    });
    cards.push({
      goalKey,
      goalLabel: GOAL_BY_KEY[goalKey]?.label ?? goalKey,
      metricLabel: def.label,
      unit: def.unit,
      higherIsBetter: def.higherIsBetter,
      current: proj.current,
      observedPerWeek: proj.observedPerWeek,
      points: series.slice(-12),
      projection:
        proj.projection && rate
          ? {
              targetValue: proj.projection.target.points[proj.projection.target.points.length - 1].value,
              weeks: rate.horizonWeeks,
              evidenceLevel: rate.evidenceLevel,
              citation: rate.citation,
              caveat: rate.caveat,
            }
          : null,
    });
  }
  return cards;
}
