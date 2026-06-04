import { z } from "zod";
import { AppError } from "@peptide/shared";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { encryptSecret, secretsEnabled, last4 } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setBody = z.object({
  provider_id: z.string().uuid(),
  api_key: z.string().min(8).max(400),
});
const delBody = z.object({ provider_id: z.string().uuid() });

// Set/replace a provider's API key (AES-encrypted at rest). Admin only. The
// plaintext key is never returned or persisted in cleartext; only last4 is kept.
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    if (!secretsEnabled()) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Key storage is disabled: set AI_SECRETS_KEY (base64 of 32 random bytes) in the deployment env to manage provider keys in-app.",
      );
    }
    const { provider_id, api_key } = await parseJson(req, setBody);
    const key = api_key.trim();
    const admin = createSupabaseAdminClient();

    const { data: provider } = await admin
      .from("ai_providers")
      .select("id")
      .eq("id", provider_id)
      .maybeSingle();
    if (!provider) throw new AppError("NOT_FOUND", "Provider not found");

    const { error } = await admin.from("ai_provider_secrets").upsert(
      {
        provider_id,
        ciphertext: encryptSecret(key),
        last4: last4(key),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );
    if (error) throw error;
    return jsonOk({ ok: true, last4: last4(key) });
  } catch (err) {
    return jsonError(err);
  }
}

// Remove a stored key (falls back to the env var, if any).
export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const { provider_id } = await parseJson(req, delBody);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("ai_provider_secrets").delete().eq("provider_id", provider_id);
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
