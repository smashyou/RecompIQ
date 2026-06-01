import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GOAL_BY_KEY,
  METRIC_BY_KEY,
  projectionRateFor,
  type GoalKey,
} from "@peptide/shared";
import { buildMetricProjection, type MetricPoint } from "@peptide/projections";

export interface GoalCard {
  goalKey: string;
  goalLabel: string;
  metricKey: string;
  metricLabel: string;
  unit: string;
  higherIsBetter: boolean;
  current: number | null;
  observedPerWeek: number | null;
  points: MetricPoint[]; // for the sparkline (trailing ~12 points)
  projection: {
    targetValue: number;
    weeks: number;
    evidenceLevel: string;
    citation: string;
    caveat: string;
  } | null;
}

// Which metric drives each goal's card (fat-loss keeps its dedicated weight card,
// so its goal card tracks waist as the complementary signal).
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

export async function loadGoalCards(userId: string): Promise<GoalCard[]> {
  const supabase = await createSupabaseServerClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [goalsRes, metricsRes, weightsRes] = await Promise.all([
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

  const byMetric = new Map<string, MetricPoint[]>();
  for (const m of metricsRes.data ?? []) {
    const key = m.metric_key as string;
    const arr = byMetric.get(key) ?? [];
    arr.push({ date: (m.logged_at as string).slice(0, 10), value: Number(m.value) });
    byMetric.set(key, arr);
  }
  const leanSeries: MetricPoint[] = (weightsRes.data ?? []).map((w) => ({
    date: (w.logged_at as string).slice(0, 10),
    value: Number(w.lean_mass_lb),
  }));

  const cards: GoalCard[] = [];
  for (const g of goalsRes.data ?? []) {
    const goalKey = g.goal_key as GoalKey;
    const def = PRIMARY[goalKey];
    if (!def) continue;
    const series = def.source === "lean" ? leanSeries : (byMetric.get(def.metricKey) ?? []);

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
      metricKey: def.metricKey,
      metricLabel: def.label,
      unit: def.unit,
      higherIsBetter: def.higherIsBetter,
      current: proj.current,
      observedPerWeek: proj.observedPerWeek,
      points: series.slice(-12),
      projection:
        proj.projection && rate
          ? {
              targetValue: proj.projection.target.points[proj.projection.target.points.length - 1]!.value,
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
