import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import type { AlertScanInput } from "@peptide/shared/alerts";

// Builds the engine's AlertScanInput from the user's recent logged rows.
// PURE engine downstream — this loader does all the DB reads + numeric coercion,
// mirroring lib/queries/dashboard.ts. Every numeric is coerced with Number().

const OZ_TO_ML = 29.5735;
const dayOf = (iso: string) => iso.slice(0, 10);

export async function buildAlertScanInput(
  supabase: SupabaseClient,
  userId: string,
): Promise<AlertScanInput> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    profile,
    goal,
    weights,
    vitals,
    foods,
    doses,
    metrics,
    symptoms,
    waters,
    conditions,
    medications,
    injuries,
    regimen,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("dob,sex")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("protein_target_g_min")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true })
      .limit(30),
    supabase
      .from("vitals")
      .select("logged_at,bp_systolic,bp_diastolic,glucose_mgdl")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30),
    supabase
      .from("food_logs")
      .select("logged_at,protein_g")
      .eq("user_id", userId)
      .gte("logged_at", sevenDaysAgo.toISOString())
      .order("logged_at", { ascending: false }),
    supabase
      .from("peptide_doses")
      .select("taken_at,adherence")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false })
      .limit(30),
    supabase
      .from("goal_metrics")
      .select("metric_key,value,logged_at")
      .eq("user_id", userId)
      .in("metric_key", ["neuro_severity", "nausea_severity"])
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase
      .from("symptoms")
      .select("logged_at,nausea")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30),
    supabase
      .from("water_logs")
      .select("logged_at,volume_oz")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase
      .from("conditions")
      .select("name")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("medications")
      .select("name")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("injuries")
      .select("name")
      .eq("user_id", userId)
      .eq("active", true),
    loadActiveRegimen(userId),
  ]);

  // --- protein summed per logged day (last ~7 days) ---
  const proteinMap = new Map<string, number>();
  for (const f of foods.data ?? []) {
    const day = dayOf(f.logged_at as string);
    proteinMap.set(day, (proteinMap.get(day) ?? 0) + Number(f.protein_g));
  }
  const proteinByDay = Array.from(proteinMap.entries()).map(([day, protein_g]) => ({
    day,
    protein_g,
  }));

  // --- water summed per day, oz -> ml ---
  const waterMap = new Map<string, number>();
  for (const w of waters.data ?? []) {
    const day = dayOf(w.logged_at as string);
    waterMap.set(day, (waterMap.get(day) ?? 0) + Number(w.volume_oz) * OZ_TO_ML);
  }
  const waterByDay = Array.from(waterMap.entries()).map(([day, ml]) => ({ day, ml }));

  // --- active compounds from the current regimen ---
  const activeCompounds = (regimen?.currentItems ?? [])
    .map((i) => i.compound)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      absolute_contraindications: c.absolute_contraindications,
      relative_contraindications: c.relative_contraindications,
    }));

  // --- age from dob, sex from profile ---
  const dob = profile.data?.dob as string | null | undefined;
  let age: number | null = null;
  if (dob) {
    const d = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
    age = Number.isFinite(years) ? years : null;
  }
  const sex = (profile.data?.sex as string | null | undefined) ?? null;

  return {
    weights: (weights.data ?? []).map((w) => ({
      logged_at: w.logged_at as string,
      value_lb: Number(w.value_lb),
    })),
    vitals: (vitals.data ?? []).map((v) => ({
      logged_at: v.logged_at as string,
      bp_systolic: v.bp_systolic !== null ? Number(v.bp_systolic) : null,
      bp_diastolic: v.bp_diastolic !== null ? Number(v.bp_diastolic) : null,
      glucose_mgdl: v.glucose_mgdl !== null ? Number(v.glucose_mgdl) : null,
    })),
    proteinByDay,
    proteinGoalMin:
      goal.data?.protein_target_g_min != null ? Number(goal.data.protein_target_g_min) : null,
    doses: (doses.data ?? []).map((d) => ({
      taken_at: d.taken_at as string,
      adherence: d.adherence as string,
    })),
    metrics: (metrics.data ?? []).map((m) => ({
      metric_key: m.metric_key as string,
      value: Number(m.value),
      logged_at: m.logged_at as string,
    })),
    symptoms: (symptoms.data ?? []).map((s) => ({
      logged_at: s.logged_at as string,
      nausea: (s.nausea as boolean | null) ?? null,
    })),
    waterByDay,
    activeCompounds,
    health: {
      conditions: (conditions.data ?? []).map((c) => c.name as string),
      medications: (medications.data ?? []).map((m) => m.name as string),
      injuries: (injuries.data ?? []).map((i) => i.name as string),
      age,
      sex,
    },
    now: new Date().toISOString(),
  };
}
