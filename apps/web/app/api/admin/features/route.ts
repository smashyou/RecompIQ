import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const featureUpdate = z.object({
  feature: z.enum(["coach", "vision", "embeddings", "insights", "stacker", "transcribe"]),
  primary_model_id: z.string().uuid(),
  fallback_ids: z.array(z.string().uuid()).max(10).default([]),
});

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ai_feature_config")
      .select("feature,primary_model_id,fallback_ids,updated_at")
      .order("feature");
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAdmin();
    const data = await parseJson(req, featureUpdate);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("ai_feature_config")
      .upsert(
        {
          feature: data.feature,
          primary_model_id: data.primary_model_id,
          fallback_ids: data.fallback_ids,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "feature" },
      );
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
