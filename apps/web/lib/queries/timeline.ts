import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { type TimelineInput, type RegimenLike } from "@peptide/shared/timeline";

export interface TimelineRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export type TimelineLoad = TimelineInput;

export async function loadTimeline(userId: string, range: TimelineRange): Promise<TimelineLoad> {
  const supabase = await createSupabaseServerClient();
  const fromTs = `${range.from}T00:00:00`;
  const toTs = `${range.to}T23:59:59.999`;

  const [weights, foods, doses, workouts, goalMetrics, labs, purchases, regimen] = await Promise.all([
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs)
      .order("logged_at", { ascending: true }),
    supabase
      .from("food_logs")
      .select("logged_at,calories_kcal,protein_g")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs),
    supabase
      .from("peptide_doses")
      .select("taken_at,adherence")
      .eq("user_id", userId)
      .gte("taken_at", fromTs)
      .lte("taken_at", toTs),
    supabase
      .from("workouts")
      .select("date,session_type,duration_min,perceived_exertion")
      .eq("user_id", userId)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("goal_metrics")
      .select("metric_key,value,unit,logged_at")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs)
      .order("logged_at", { ascending: true }),
    supabase
      .from("lab_results")
      .select("collected_on,marker,marker_key,value,unit,ref_low,ref_high")
      .eq("user_id", userId)
      .gte("collected_on", range.from)
      .lte("collected_on", range.to),
    supabase
      .from("peptide_purchases")
      .select("purchased_on,price_usd")
      .eq("user_id", userId)
      .gte("purchased_on", range.from)
      .lte("purchased_on", range.to),
    loadActiveRegimen(userId),
  ]);

  const regimenLike: RegimenLike | null = regimen
    ? {
        phases: regimen.phases.map((p) => ({
          starts_on: p.starts_on,
          ends_on: p.ends_on,
          items: p.items.map((i) => ({
            compound: i.compound ? { name: i.compound.name } : null,
            starts_on: i.starts_on,
            ends_on: i.ends_on,
          })),
        })),
      }
    : null;

  return {
    range: { startISO: range.from, endISO: range.to },
    weights: (weights.data ?? []).map((w) => ({ logged_at: w.logged_at, value_lb: Number(w.value_lb) })),
    foods: (foods.data ?? []).map((f) => ({
      logged_at: f.logged_at,
      calories_kcal: Number(f.calories_kcal),
      protein_g: Number(f.protein_g),
    })),
    doses: (doses.data ?? []).map((d) => ({ taken_at: d.taken_at, adherence: d.adherence })),
    workouts: (workouts.data ?? []).map((w) => ({
      date: w.date,
      session_type: w.session_type,
      duration_min: w.duration_min,
      perceived_exertion: w.perceived_exertion,
    })),
    goalMetrics: (goalMetrics.data ?? []).map((g) => ({
      metric_key: g.metric_key,
      value: Number(g.value),
      unit: g.unit,
      logged_at: g.logged_at,
    })),
    labs: (labs.data ?? []).map((l) => ({
      collected_on: l.collected_on,
      marker: l.marker,
      marker_key: l.marker_key,
      value: Number(l.value),
      unit: l.unit,
      ref_low: l.ref_low !== null ? Number(l.ref_low) : null,
      ref_high: l.ref_high !== null ? Number(l.ref_high) : null,
    })),
    purchases: (purchases.data ?? []).map((p) => ({
      purchased_on: p.purchased_on,
      price_usd: Number(p.price_usd),
    })),
    regimen: regimenLike,
  };
}
