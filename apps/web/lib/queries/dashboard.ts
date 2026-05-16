import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DashboardSnapshot {
  profile: { display_name: string | null; is_demo: boolean } | null;
  goal: {
    start_weight_lb: number;
    goal_weight_lb_min: number;
    goal_weight_lb_max: number;
    timeline_weeks: number;
    phase: string | null;
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
  macrosToday: {
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  hasActiveStack: boolean;
  recentDoses: { taken_at: string; adherence: string }[];
  todayWorkout: {
    id: string;
    name: string | null;
    session_type: string;
    duration_min: number | null;
    perceived_exertion: number | null;
    exerciseCount: number;
  } | null;
  workoutSuggestion: {
    slug: string;
    name: string;
    phase: string;
    session_type: string;
  } | null;
}

export async function loadDashboard(userId: string): Promise<DashboardSnapshot> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    profile,
    goal,
    weights,
    latestVital,
    latestSymptom,
    todaySteps,
    todaySleep,
    todayFoods,
    activeStacks,
    recentDoses,
    todayWorkoutRow,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name,is_demo")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("goals")
        .select(
          "start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks,phase,protein_target_g_min,protein_target_g_max,created_at",
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
      supabase
        .from("food_logs")
        .select("calories_kcal,protein_g,carbs_g,fat_g")
        .eq("user_id", userId)
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59.999`),
      supabase
        .from("peptide_stacks")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1),
      supabase
        .from("peptide_doses")
        .select("taken_at,adherence")
        .eq("user_id", userId)
        .gte("taken_at", fourteenDaysAgo.toISOString())
        .order("taken_at", { ascending: false }),
      supabase
        .from("workouts")
        .select("id,name,session_type,duration_min,perceived_exertion, workout_exercises(id)")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1)
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
          phase: (goal.data.phase as string | null) ?? null,
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
    macrosToday: (todayFoods.data ?? []).reduce(
      (acc, row) => ({
        calories_kcal: acc.calories_kcal + Number(row.calories_kcal),
        protein_g: acc.protein_g + Number(row.protein_g),
        carbs_g: acc.carbs_g + Number(row.carbs_g),
        fat_g: acc.fat_g + Number(row.fat_g),
      }),
      { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ),
    hasActiveStack: (activeStacks.data?.length ?? 0) > 0,
    recentDoses: (recentDoses.data ?? []).map((d) => ({
      taken_at: d.taken_at as string,
      adherence: d.adherence as string,
    })),
    todayWorkout: todayWorkoutRow.data
      ? {
          id: todayWorkoutRow.data.id as string,
          name: (todayWorkoutRow.data.name as string | null) ?? null,
          session_type: todayWorkoutRow.data.session_type as string,
          duration_min: (todayWorkoutRow.data.duration_min as number | null) ?? null,
          perceived_exertion:
            (todayWorkoutRow.data.perceived_exertion as number | null) ?? null,
          exerciseCount:
            (todayWorkoutRow.data.workout_exercises as { id: string }[] | undefined)?.length ?? 0,
        }
      : null,
    workoutSuggestion: await pickWorkoutSuggestion(supabase, goal.data?.phase ?? "P1"),
  };
}

async function pickWorkoutSuggestion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  phase: string,
) {
  const { data } = await supabase
    .from("workout_templates")
    .select("slug,name,phase,session_type")
    .eq("phase", phase)
    .limit(1)
    .maybeSingle();
  return data
    ? {
        slug: data.slug as string,
        name: data.name as string,
        phase: data.phase as string,
        session_type: data.session_type as string,
      }
    : null;
}

// naiveProjection removed — use buildProjection from @peptide/projections instead.
