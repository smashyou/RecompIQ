import { z } from "zod";
import { AppError } from "@peptide/shared";
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

    // Guard: the primary model's provider must be configured on this deploy,
    // otherwise the feature errors at call time. (e.g. picking a gateway /
    // openrouter model whose API key isn't set in Vercel.)
    const { data: primaryModel } = await supabase
      .from("ai_models")
      .select("display_name, ai_providers(slug, env_key_var)")
      .eq("id", data.primary_model_id)
      .maybeSingle<{ display_name: string; ai_providers: { slug: string; env_key_var: string } }>();
    if (primaryModel) {
      const keyVar = primaryModel.ai_providers?.env_key_var;
      const keyPresent = Boolean(keyVar && process.env[keyVar] && process.env[keyVar]!.trim() !== "");
      if (!keyPresent) {
        throw new AppError(
          "VALIDATION_FAILED",
          `Can't set "${primaryModel.display_name}" as the primary model: its provider (${primaryModel.ai_providers?.slug}) isn't configured on this deployment. Add ${keyVar} in Vercel, or choose a model from a configured provider.`,
        );
      }
    }

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
