import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { chat, embed } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testBody = z.object({
  model_id: z.string().uuid(),
});

interface ModelTestRow {
  modality: "chat" | "vision" | "embedding";
  ai_providers: { slug: string; env_key_var: string };
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const { model_id } = await parseJson(req, testBody);
    const supabase = await createSupabaseServerClient();

    // Look up the model + provider so we can check the key + temporarily route to it.
    const { data: model } = await supabase
      .from("ai_models")
      .select("modality, ai_providers(slug,env_key_var)")
      .eq("id", model_id)
      .maybeSingle<ModelTestRow>();
    if (!model) {
      return jsonOk({ ok: false, error: "Model not found" });
    }
    const envKey = process.env[model.ai_providers.env_key_var];
    if (!envKey || envKey.trim() === "") {
      return jsonOk({
        ok: false,
        error: `Missing ${model.ai_providers.env_key_var} env var. Add it in Vercel → Settings → Environment Variables.`,
      });
    }

    // Temporarily override the relevant feature config so the chat/embed call
    // routes to THIS model. We don't persist this — we restore the original
    // config in finally.
    const featureForModality: Record<typeof model.modality, "coach" | "embeddings"> = {
      chat: "coach",
      vision: "coach", // vision uses chat path
      embedding: "embeddings",
    };
    const targetFeature = featureForModality[model.modality];

    const { data: orig } = await supabase
      .from("ai_feature_config")
      .select("primary_model_id,fallback_ids")
      .eq("feature", targetFeature)
      .maybeSingle();
    if (!orig) {
      return jsonOk({ ok: false, error: `No feature config for ${targetFeature}` });
    }

    await supabase
      .from("ai_feature_config")
      .update({ primary_model_id: model_id, fallback_ids: [], updated_by: user.id })
      .eq("feature", targetFeature);

    try {
      const t0 = Date.now();
      if (model.modality === "embedding") {
        const r = await embed({ feature: "embeddings", input: "ping" });
        return jsonOk({
          ok: true,
          latency_ms: Date.now() - t0,
          model: r.model,
          provider: r.provider_slug,
          dims: r.vectors[0]?.length ?? 0,
        });
      } else {
        const r = await chat({
          feature: targetFeature,
          messages: [
            { role: "system", content: "Reply with the single word PONG." },
            { role: "user", content: "ping" },
          ],
          max_tokens: 16,
        });
        return jsonOk({
          ok: true,
          latency_ms: Date.now() - t0,
          model: r.model,
          provider: r.provider_slug,
          text: r.text,
          input_tokens: r.input_tokens,
          output_tokens: r.output_tokens,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonOk({ ok: false, error: message });
    } finally {
      await supabase
        .from("ai_feature_config")
        .update({
          primary_model_id: orig.primary_model_id,
          fallback_ids: orig.fallback_ids,
          updated_by: user.id,
        })
        .eq("feature", targetFeature);
    }
  } catch (err) {
    return jsonError(err);
  }
}
