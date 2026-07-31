import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEnergyBudget, yearsSince } from "@/lib/energy-budget";
import { regimenSelectFields, shapeRegimen } from "@/lib/queries/regimen";

/**
 * The payload the off-platform insight generator receives.
 *
 * DE-IDENTIFIED ON PURPOSE. The generator runs on the VPS, which also hosts a
 * dozen unrelated agents, so the snapshot carries no display name, no email and
 * no date of birth — age is derived here and the DOB stays in the database. A
 * `user_id` is the only handle that leaves, and it is opaque without database
 * access. The insight comes back keyed on that id and is joined server-side.
 *
 * It is also narrow rather than a table dump: only the signals a daily insight
 * could legitimately reason about. The hardcoded template this replaces saw
 * weight and protein and nothing else, which is exactly why it never once
 * mentioned a peptide, a workout, a lab or an injury.
 */
export interface InsightSnapshot {
  user_id: string;
  generated_for: string;
  timezone: string;
  profile: { age: number | null; sex: string | null };
  goal: {
    start_weight_lb: number;
    goal_weight_lb_min: number;
    goal_weight_lb_max: number;
    timeline_weeks: number;
    phase: string | null;
    protein_target_g_min: number;
    protein_target_g_max: number;
    weeks_elapsed: number;
  } | null;
  energy: { target_kcal: number | null; tdee_kcal: number | null; protein_g_min: number | null };
  weights: { logged_at: string; value_lb: number }[];
  daily_intake: { day: string; kcal: number; protein_g: number }[];
  avg_steps_per_day: number | null;
  vitals: {
    logged_at: string;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    hr: number | null;
    glucose_mgdl: number | null;
  }[];
  symptoms: {
    logged_at: string;
    mood: number | null;
    energy: number | null;
    pain: number | null;
    nausea: boolean | null;
  }[];
  workouts: { performed_at: string; session_type: string; duration_min: number | null; rpe: number | null }[];
  regimen: { name: string; slug: string; frequency: string | null; evidence_level: string | null }[];
  doses: { taken_at: string; adherence: string }[];
  labs: { marker: string; value: number; unit: string | null; collected_on: string }[];
  conditions: string[];
  injuries: string[];
  medications: string[];
  open_alerts: { kind: string; severity: string; title: string }[];
  /** Guard vocabulary — see @peptide/peptides/insights. */
  known_compounds: string[];
}

const DAY_MS = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY_MS).toISOString();
const ymd = (daysAgo: number) => iso(daysAgo).slice(0, 10);
const num = (v: unknown): number => Number(v ?? 0);

/** The user's local calendar day, so "today's insight" means their today. */
export function localDay(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Build one user's snapshot. Takes the client rather than creating one so the
 * cron can pass its admin client and a future user-triggered "regenerate" can
 * pass a user-scoped one without a second implementation.
 */
export async function buildInsightSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<InsightSnapshot> {
  const [
    profileRes,
    goalRes,
    weightsRes,
    foodRes,
    stepsRes,
    vitalsRes,
    symptomsRes,
    workoutsRes,
    regimenRes,
    dosesRes,
    labsRes,
    conditionsRes,
    injuriesRes,
    medicationsRes,
    alertsRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("dob,sex,height_in").eq("user_id", userId).maybeSingle(),
    supabase
      .from("goals")
      .select(
        "start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks,phase,protein_target_g_min,protein_target_g_max,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Newest-first + limit, reversed below. Ascending + limit returns the OLDEST
    // rows and silently freezes the series once the user passes the limit.
    supabase
      .from("weights")
      .select("logged_at,value_lb,body_fat_pct,lean_mass_lb")
      .eq("user_id", userId)
      .gte("logged_at", iso(28))
      .order("logged_at", { ascending: false })
      .limit(40),
    supabase
      .from("food_logs")
      .select("logged_at,calories_kcal,protein_g")
      .eq("user_id", userId)
      .gte("logged_at", iso(7)),
    supabase.from("steps_logs").select("day,count").eq("user_id", userId).gte("day", ymd(14)),
    supabase
      .from("vitals")
      .select("logged_at,bp_systolic,bp_diastolic,hr,glucose_mgdl")
      .eq("user_id", userId)
      .gte("logged_at", iso(14))
      .order("logged_at", { ascending: false })
      .limit(20),
    supabase
      .from("symptoms")
      .select("logged_at,mood,energy,pain,nausea")
      .eq("user_id", userId)
      .gte("logged_at", iso(14))
      .order("logged_at", { ascending: false })
      .limit(20),
    supabase
      .from("workouts")
      .select("date,session_type,duration_min,perceived_exertion")
      .eq("user_id", userId)
      .gte("date", ymd(14))
      .order("date", { ascending: false })
      .limit(20),
    // "Active" is not a column on regimen_items — it is derived (phase not
    // ended AND item not ended). Reuse shapeRegimen so this agrees with what
    // the dashboard and the alert engine consider current.
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
      .gte("taken_at", iso(28))
      .order("taken_at", { ascending: false })
      .limit(120),
    supabase
      .from("lab_results")
      .select("marker,value,unit,collected_on")
      .eq("user_id", userId)
      .order("collected_on", { ascending: false })
      .limit(30),
    supabase.from("conditions").select("name").eq("user_id", userId).eq("active", true),
    supabase.from("injuries").select("name").eq("user_id", userId).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", userId).eq("active", true),
    supabase
      .from("alerts")
      .select("kind,severity,title")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("severity"),
    supabase.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);

  const profile = profileRes.data as { dob?: string | null; sex?: string | null; height_in?: number | null } | null;
  const goal = goalRes.data as InsightSnapshot["goal"] & { created_at: string };
  const weights = ((weightsRes.data ?? []) as { logged_at: string; value_lb: number }[]).slice().reverse();

  // Steps: mean of LOGGED days only. Absent step data is not evidence of being
  // sedentary, so it stays null and TDEE declines to guess.
  const stepRows = (stepsRes.data ?? []) as { day: string; count: number }[];
  const avgSteps =
    stepRows.length > 0
      ? Math.round(stepRows.reduce((s, r) => s + num(r.count), 0) / stepRows.length)
      : null;

  const byDay = new Map<string, { kcal: number; protein_g: number }>();
  for (const row of (foodRes.data ?? []) as { logged_at: string; calories_kcal: number; protein_g: number }[]) {
    const day = String(row.logged_at).slice(0, 10);
    const acc = byDay.get(day) ?? { kcal: 0, protein_g: 0 };
    acc.kcal += num(row.calories_kcal);
    acc.protein_g += num(row.protein_g);
    byDay.set(day, acc);
  }

  const budget = buildEnergyBudget({
    profile,
    latestWeight: (weightsRes.data ?? [])[0] ?? null,
    goal: goal ?? null,
    avgStepsPerDay: avgSteps,
  });

  const regimen = (shapeRegimen((regimenRes.data ?? null) as Parameters<typeof shapeRegimen>[0])?.currentItems ?? [])
    .filter((i) => i.compound)
    .map((i) => ({
      name: i.compound!.name,
      slug: i.compound!.slug,
      frequency: i.frequency,
      evidence_level: i.compound!.evidence_level,
    }));

  const tz = (settingsRes.data as { timezone?: string } | null)?.timezone ?? "UTC";

  return {
    user_id: userId,
    generated_for: localDay(new Date(), tz),
    timezone: tz,
    profile: { age: profile?.dob ? yearsSince(profile.dob) : null, sex: profile?.sex ?? null },
    goal: goal
      ? {
          start_weight_lb: num(goal.start_weight_lb),
          goal_weight_lb_min: num(goal.goal_weight_lb_min),
          goal_weight_lb_max: num(goal.goal_weight_lb_max),
          timeline_weeks: num(goal.timeline_weeks),
          phase: goal.phase ?? null,
          protein_target_g_min: num(goal.protein_target_g_min),
          protein_target_g_max: num(goal.protein_target_g_max),
          weeks_elapsed: Math.max(
            0,
            Math.floor((Date.now() - new Date(goal.created_at).getTime()) / (7 * DAY_MS)),
          ),
        }
      : null,
    energy: {
      target_kcal: budget.energy?.targetKcal ?? null,
      tdee_kcal: budget.energy?.tdeeKcal ?? null,
      protein_g_min: budget.macros?.proteinGMin ?? null,
    },
    weights: weights.map((w) => ({ logged_at: w.logged_at, value_lb: num(w.value_lb) })),
    daily_intake: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, kcal: Math.round(v.kcal), protein_g: Math.round(v.protein_g) })),
    avg_steps_per_day: avgSteps,
    vitals: (vitalsRes.data ?? []) as InsightSnapshot["vitals"],
    symptoms: (symptomsRes.data ?? []) as InsightSnapshot["symptoms"],
    workouts: ((workoutsRes.data ?? []) as {
      date: string;
      session_type: string;
      duration_min: number | null;
      perceived_exertion: number | null;
    }[]).map((w) => ({
      performed_at: w.date,
      session_type: w.session_type,
      duration_min: w.duration_min,
      rpe: w.perceived_exertion,
    })),
    regimen,
    doses: (dosesRes.data ?? []) as InsightSnapshot["doses"],
    labs: ((labsRes.data ?? []) as { marker: string; value: number; unit: string | null; collected_on: string }[]).map(
      (l) => ({ marker: l.marker, value: num(l.value), unit: l.unit, collected_on: l.collected_on }),
    ),
    conditions: ((conditionsRes.data ?? []) as { name: string }[]).map((c) => c.name),
    injuries: ((injuriesRes.data ?? []) as { name: string }[]).map((i) => i.name),
    medications: ((medicationsRes.data ?? []) as { name: string }[]).map((m) => m.name),
    open_alerts: (alertsRes.data ?? []) as InsightSnapshot["open_alerts"],
    known_compounds: [...new Set(regimen.flatMap((r) => [r.name, r.slug]))],
  };
}
