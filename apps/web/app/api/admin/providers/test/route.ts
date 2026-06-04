// Admin: live "Test connection" for a single AI provider. Reads the provider's
// env key server-side and makes a minimal call to confirm key + reachability.

import { z } from "zod";
import { pingProvider, type ProviderKind } from "@peptide/agent";
import { AppError } from "@peptide/shared";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProviderKey } from "@/lib/agent";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const input = z.object({ slug: z.string().min(1).max(60) });

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { slug } = await parseJson(req, input);
    const supabase = await createSupabaseServerClient();

    const { data: provider } = await supabase
      .from("ai_providers")
      .select("slug, name, kind, env_key_var")
      .eq("slug", slug)
      .maybeSingle();
    if (!provider) throw new AppError("NOT_FOUND", "Provider not found");

    const apiKey = await resolveProviderKey(provider.env_key_var);
    if (!apiKey) {
      return jsonOk({
        ok: false,
        configured: false,
        error: `No key for ${provider.env_key_var} — set it in Admin or as a server env var.`,
      });
    }

    // Pick a representative active model for this provider (chat/vision preferred).
    const { data: models } = await supabase
      .from("ai_models")
      .select("model_id, modality, ai_providers!inner(slug)")
      .eq("ai_providers.slug", slug)
      .eq("active", true)
      .limit(10);
    const rows = (models ?? []) as unknown as { model_id: string; modality: string }[];
    const pick =
      rows.find((m) => m.modality === "chat") ??
      rows.find((m) => m.modality === "vision") ??
      rows[0];
    if (!pick) throw new AppError("NOT_FOUND", "No active model for this provider");

    const result = await pingProvider({
      kind: provider.kind as ProviderKind,
      providerSlug: provider.slug,
      modelId: pick.model_id,
      apiKey,
    });

    return jsonOk({ ...result, configured: true });
  } catch (err) {
    return jsonError(err);
  }
}
