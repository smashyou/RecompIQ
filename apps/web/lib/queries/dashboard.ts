import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DashboardSnapshot {
  profile: { display_name: string | null; is_demo: boolean } | null;
  goal: {
    start_weight_lb: number;
    goal_weight_lb_min: number;
    goal_weight_lb_max: number;
    timeline_weeks: number;
    protein_target_g_min: number;
    protein_target_g_max: number;
    created_at: string;
  } | null;
  weightSeries: { logged_at: string; value_lb: number }[];
  latestWeight: { value_lb: number; logged_at: string } | null;
  latestVital: {
    logged_at: string;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    hr: number | null;
    glucose_mgdl: number | null;
  } | null;
  latestSymptom: {
    logged_at: string;
    mood: number | null;
    energy: number | null;
    pain: number | null;
    nausea: boolean | null;
  } | null;
  todaySteps: number | null;
  todaySleepMin: number | null;
}

export async function loadDashboard(userId: string): Promise<DashboardSnapshot> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [profile, goal, weights, latestVital, latestSymptom, todaySteps, todaySleep] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name,is_demo")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("goals")
        .select(
          "start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks,protein_target_g_min,protein_target_g_max,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("weights")
        .select("logged_at,value_lb")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true })
        .limit(60),
      supabase
        .from("vitals")
        .select("logged_at,bp_systolic,bp_diastolic,hr,glucose_mgdl")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("symptoms")
        .select("logged_at,mood,energy,pain,nausea")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("steps_logs")
        .select("count")
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle(),
      supabase
        .from("sleep_logs")
        .select("duration_min")
        .eq("user_id", userId)
        .eq("night_of", today)
        .maybeSingle(),
    ]);

  const weightSeries = (weights.data ?? []).map((w) => ({
    logged_at: w.logged_at as string,
    value_lb: Number(w.value_lb),
  }));
  const latestWeight =
    weightSeries.length > 0 ? weightSeries[weightSeries.length - 1]! : null;

  return {
    profile: profile.data
      ? { display_name: profile.data.display_name, is_demo: profile.data.is_demo }
      : null,
    goal: goal.data
      ? {
          start_weight_lb: Number(goal.data.start_weight_lb),
          goal_weight_lb_min: Number(goal.data.goal_weight_lb_min),
          goal_weight_lb_max: Number(goal.data.goal_weight_lb_max),
          timeline_weeks: goal.data.timeline_weeks,
          protein_target_g_min: goal.data.protein_target_g_min,
          protein_target_g_max: goal.data.protein_target_g_max,
          created_at: goal.data.created_at,
        }
      : null,
    weightSeries,
    latestWeight,
    latestVital: latestVital.data
      ? {
          logged_at: latestVital.data.logged_at,
          bp_systolic: latestVital.data.bp_systolic,
          bp_diastolic: latestVital.data.bp_diastolic,
          hr: latestVital.data.hr,
          glucose_mgdl:
            latestVital.data.glucose_mgdl !== null ? Number(latestVital.data.glucose_mgdl) : null,
        }
      : null,
    latestSymptom: latestSymptom.data
      ? {
          logged_at: latestSymptom.data.logged_at,
          mood: latestSymptom.data.mood,
          energy: latestSymptom.data.energy,
          pain: latestSymptom.data.pain,
          nausea: latestSymptom.data.nausea,
        }
      : null,
    todaySteps: todaySteps.data?.count ?? null,
    todaySleepMin: todaySleep.data?.duration_min ?? null,
  };
}

// Tiny linear projection: use most recent 14d slope, project forward to target band.
export function naiveProjection(
  series: { logged_at: string; value_lb: number }[],
  goalMin: number,
  goalMax: number,
): { etaWeeks: number | null; weeklyLossLb: number | null } {
  if (series.length < 4) return { etaWeeks: null, weeklyLossLb: null };
  const recent = series.slice(-14);
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const daysSpan =
    (new Date(last.logged_at).getTime() - new Date(first.logged_at).getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysSpan < 1) return { etaWeeks: null, weeklyLossLb: null };
  const totalChange = first.value_lb - last.value_lb; // positive = losing
  const weeklyLossLb = (totalChange / daysSpan) * 7;
  if (weeklyLossLb <= 0) return { etaWeeks: null, weeklyLossLb };
  const targetMid = (goalMin + goalMax) / 2;
  if (last.value_lb <= goalMax) return { etaWeeks: 0, weeklyLossLb };
  const lbsToGo = last.value_lb - targetMid;
  return { etaWeeks: Math.ceil(lbsToGo / weeklyLossLb), weeklyLossLb };
}
