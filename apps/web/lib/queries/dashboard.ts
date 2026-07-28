import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CalorieTarget, MacroTargets } from "@peptide/shared/goals/energy";
import { averageSteps, buildEnergyBudget } from "@/lib/energy-budget";
import {
  regimenSelectFields,
  shapeRegimen,
  type ActiveRegimenView,
} from "@/lib/queries/regimen";

export interface DashboardSnapshot {
  /**
   * Daily energy budget derived from the LATEST weigh-in. Null when BMR can't be
   * established (no recorded sex and no body-fat reading, or missing height/age)
   * — the UI prompts for the missing field rather than showing a guessed number.
   */
  energy: CalorieTarget | null;
  macroTargets: MacroTargets | null;
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
  activeStack: {
    phase: string | null;
    items: {
      slug: string;
      name: string;
      descriptor: string | null;
      evidence_level: string;
      fda_approved: boolean;
    }[];
  } | null;
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
  bodyShotReminder: {
    daysOverdue: number;
    lastCapturedAt: string | null;
    frequencyDays: number;
  } | null;
}

export async function loadDashboard(userId: string): Promise<DashboardSnapshot> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const stepsWindowStart = fourteenDaysAgo.toISOString().slice(0, 10);

  const [
    profile,
    goal,
    weights,
    latestVital,
    latestSymptom,
    todaySteps,
    recentSteps,
    todaySleep,
    todayFoods,
    activeRegimenRow,
    recentDoses,
    todayWorkoutRow,
    latestBodyShot,
    userSettings,
  ] = await Promise.all([
      supabase
        // dob/sex/height feed the BMR equation behind the calorie target.
        .from("profiles")
        .select("display_name,is_demo,dob,sex,height_in")
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
        // body_fat_pct / lean_mass_lb are nullable smart-scale fields. When
        // present they switch BMR to Katch-McArdle, which drops the fat-mass
        // term that makes weight-based equations drift at high body fat.
        // DESCENDING + limit, then reversed below. Ascending + limit returns the
        // OLDEST 60 rows, so past 60 weigh-ins the dashboard would have frozen
        // on old data forever — the weight card, the projection and the calorie
        // target all read the last element of this series.
        .from("weights")
        .select("logged_at,value_lb,body_fat_pct,lean_mass_lb")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
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
      // Recent steps → a MEASURED activity factor for TDEE. One day is too
      // noisy; this averages the logged days in the window and stays null when
      // nothing is logged (absent steps are not evidence of being sedentary).
      supabase
        .from("steps_logs")
        .select("day,count")
        .eq("user_id", userId)
        .gte("day", stepsWindowStart)
        .order("day", { ascending: false }),
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
        .from("regimens")
        .select(regimenSelectFields)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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
      supabase
        .from("body_photos")
        .select("captured_at")
        .eq("user_id", userId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("body_photo_frequency_days")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  // Fetched newest-first (see the query); flip back to chronological order,
  // which every downstream consumer — chart, projection, latestWeight — assumes.
  const weightRowsAsc = [...(weights.data ?? [])].reverse();
  const weightSeries = weightRowsAsc.map((w) => ({
    logged_at: w.logged_at as string,
    value_lb: Number(w.value_lb),
  }));
  const regimen = shapeRegimen(
    (activeRegimenRow.data as Parameters<typeof shapeRegimen>[0]) ?? null,
  );
  const latestWeight =
    weightSeries.length > 0 ? weightSeries[weightSeries.length - 1]! : null;

  // ---- energy budget -------------------------------------------------------
  // Computed off the LATEST weigh-in, not the onboarding start weight, so the
  // target tracks the body it is describing instead of freezing on day one.
  // From the chronological copy — the raw rows are newest-first.
  const latestWeightRow = weightRowsAsc.at(-1) as
    | { value_lb: number | string; body_fat_pct: number | null; lean_mass_lb: number | null }
    | undefined;

  const { energy, macros } = buildEnergyBudget({
    profile: profile.data ?? null,
    latestWeight: latestWeightRow ?? null,
    goal: goal.data ?? null,
    avgStepsPerDay: averageSteps(
      (recentSteps.data ?? []) as Array<{ count: number | string }>,
    ),
  });

  return {
    energy,
    macroTargets: macros,
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
    hasActiveStack: (regimen?.currentItems.length ?? 0) > 0,
    activeStack: mapActiveRegimen(regimen),
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
    bodyShotReminder: computeBodyShotReminder(
      latestBodyShot.data?.captured_at as string | null | undefined,
      userSettings.data?.body_photo_frequency_days as number | null | undefined,
    ),
  };
}

function computeBodyShotReminder(
  lastCapturedAt: string | null | undefined,
  frequencyDays: number | null | undefined,
) {
  const freq = frequencyDays ?? 7;
  if (freq === 0) return null;
  if (!lastCapturedAt) {
    return { daysOverdue: 0, lastCapturedAt: null, frequencyDays: freq };
  }
  const lastMs = new Date(lastCapturedAt).getTime();
  const nextMs = lastMs + freq * 86_400_000;
  const daysOverdue = Math.max(0, Math.floor((Date.now() - nextMs) / 86_400_000));
  if (daysOverdue === 0 && Date.now() < nextMs) return null;
  return { daysOverdue, lastCapturedAt, frequencyDays: freq };
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

// Maps the active regimen's current items into the dashboard's "active stack"
// card shape. "Current" = items in still-open phases that haven't ended — i.e.
// what the user is on right now (handles a regimen with concurrent phases).
function mapActiveRegimen(
  regimen: ActiveRegimenView | null,
): DashboardSnapshot["activeStack"] {
  if (!regimen || regimen.currentItems.length === 0) return null;
  const items = regimen.currentItems
    .map((i) => i.compound)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      descriptor: c.short_description ?? null,
      evidence_level: c.evidence_level ?? "ANECDOTAL",
      fda_approved: c.fda_approved,
    }));
  const phaseLabel =
    regimen.currentPhase?.legacy_phase ?? regimen.currentPhase?.name ?? null;
  return { phase: phaseLabel, items };
}

// naiveProjection removed — use buildProjection from @peptide/projections instead.
