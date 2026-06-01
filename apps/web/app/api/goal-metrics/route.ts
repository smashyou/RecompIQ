import { goalMetricsBatchInput, type GoalMetricsBatchInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Log one or more goal-metric points (1–10 sliders, circumference, cognition).
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { metrics } = (await parseJson(req, goalMetricsBatchInput)) as GoalMetricsBatchInput;
    const supabase = await createSupabaseServerClient();
    const rows = metrics.map((m) => ({
      user_id: user.id,
      metric_key: m.metric_key,
      value: m.value,
      unit: m.unit ?? null,
      goal_key: m.goal_key ?? null,
      logged_at: (m.logged_at ?? new Date()).toISOString(),
      note: m.note ?? null,
    }));
    const { error } = await supabase.from("goal_metrics").insert(rows);
    if (error) throw error;
    return jsonOk({ count: rows.length });
  } catch (err) {
    return jsonError(err);
  }
}

// Read a metric series (optionally a single metric_key, within a date range).
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metric_key");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("goal_metrics")
      .select("metric_key,value,unit,goal_key,logged_at,note")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true })
      .limit(2000);
    if (metricKey) query = query.eq("metric_key", metricKey);
    if (from) query = query.gte("logged_at", `${from}T00:00:00`);
    if (to) query = query.lte("logged_at", `${to}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
