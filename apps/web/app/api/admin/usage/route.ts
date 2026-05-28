import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CallRow {
  feature: string;
  provider_slug: string;
  model_string: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 7)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("ai_calls")
      .select(
        "feature,provider_slug,model_string,input_tokens,output_tokens,total_cost_usd,latency_ms,status,created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as CallRow[];

    type AggKey = string;
    const byFeature = new Map<AggKey, {
      feature: string;
      calls: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      errors: number;
      fallbacks: number;
    }>();
    const byModel = new Map<AggKey, {
      provider_slug: string;
      model_string: string;
      calls: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      avg_latency_ms: number;
    }>();

    for (const r of rows) {
      const fKey = r.feature;
      const f = byFeature.get(fKey) ?? {
        feature: r.feature,
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        errors: 0,
        fallbacks: 0,
      };
      f.calls++;
      f.input_tokens += r.input_tokens ?? 0;
      f.output_tokens += r.output_tokens ?? 0;
      f.cost_usd += Number(r.total_cost_usd ?? 0);
      if (r.status === "error") f.errors++;
      if (r.status === "fallback") f.fallbacks++;
      byFeature.set(fKey, f);

      const mKey = `${r.provider_slug}/${r.model_string}`;
      const m = byModel.get(mKey) ?? {
        provider_slug: r.provider_slug,
        model_string: r.model_string,
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        avg_latency_ms: 0,
      };
      m.calls++;
      m.input_tokens += r.input_tokens ?? 0;
      m.output_tokens += r.output_tokens ?? 0;
      m.cost_usd += Number(r.total_cost_usd ?? 0);
      m.avg_latency_ms = Math.round(
        (m.avg_latency_ms * (m.calls - 1) + (r.latency_ms ?? 0)) / m.calls,
      );
      byModel.set(mKey, m);
    }

    return jsonOk({
      days,
      total_calls: rows.length,
      total_cost_usd: Number(
        rows.reduce((acc, r) => acc + Number(r.total_cost_usd ?? 0), 0).toFixed(4),
      ),
      by_feature: Array.from(byFeature.values()).sort((a, b) => b.cost_usd - a.cost_usd),
      by_model: Array.from(byModel.values()).sort((a, b) => b.cost_usd - a.cost_usd),
      recent: rows.slice(0, 20),
    });
  } catch (err) {
    return jsonError(err);
  }
}
