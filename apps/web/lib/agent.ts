import "server-only";
import {
  chat as gatewayChat,
  chatStream as gatewayChatStream,
  embed as gatewayEmbed,
  parseFoodFromImage as gatewayParseFood,
  parseLabsFromContent as gatewayParseLabs,
  generateStack as gatewayGenerateStack,
  type AiCallLog,
  type GenerateStackOpts,
  type GenerateStackResult,
  type ChatRequest,
  type ChatResponse,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type Feature,
  type FeatureConfig,
  type GatewayDeps,
  type ModelRow,
  type ParseFoodFromImageOpts,
  type ParseFoodFromImageResult,
  type ParseLabsOpts,
  type ParseLabsResult,
  type ProviderKind,
} from "@peptide/agent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redactedLogger } from "@peptide/shared";
import { decryptSecret } from "@/lib/secrets";

interface FeatureConfigRow {
  feature: Feature;
  primary_model_id: string;
  fallback_ids: string[];
}

interface ModelJoinRow {
  id: string;
  model_id: string;
  display_name: string;
  modality: "chat" | "vision" | "embedding";
  context_window: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  ai_providers: {
    slug: string;
    kind: ProviderKind;
    env_key_var: string;
  };
}

function toModelRow(row: ModelJoinRow): ModelRow {
  return {
    id: row.id,
    model_id: row.model_id,
    display_name: row.display_name,
    modality: row.modality,
    context_window: row.context_window,
    input_cost_per_1m: row.input_cost_per_1m,
    output_cost_per_1m: row.output_cost_per_1m,
    provider_slug: row.ai_providers.slug,
    provider_kind: row.ai_providers.kind,
    env_key_var: row.ai_providers.env_key_var,
  };
}

async function loadFeatureConfig(feature: Feature): Promise<FeatureConfig | null> {
  const supabase = await createSupabaseServerClient();
  const { data: cfg } = await supabase
    .from("ai_feature_config")
    .select("feature,primary_model_id,fallback_ids")
    .eq("feature", feature)
    .maybeSingle<FeatureConfigRow>();
  if (!cfg) return null;
  const allIds = [cfg.primary_model_id, ...(cfg.fallback_ids ?? [])];
  if (allIds.length === 0) return null;
  const { data: models } = await supabase
    .from("ai_models")
    .select(
      "id,model_id,display_name,modality,context_window,input_cost_per_1m,output_cost_per_1m, ai_providers(slug,kind,env_key_var)",
    )
    .in("id", allIds);
  const rows = (models ?? []) as unknown as ModelJoinRow[];
  const byId = new Map(rows.map((r) => [r.id, toModelRow(r)]));
  const primary = byId.get(cfg.primary_model_id);
  if (!primary) return null;
  const fallbacks = (cfg.fallback_ids ?? [])
    .map((id) => byId.get(id))
    .filter((m): m is ModelRow => Boolean(m));
  return { feature, primary, fallbacks };
}

// Admin-set provider keys (ai_provider_secrets, AES-encrypted) take precedence
// over env vars. Loaded + decrypted into a short-TTL cache, then threaded into a
// PER-REQUEST GatewayDeps (no shared mutable module state — avoids a cross-request
// overwrite race in long-lived Fluid Compute instances).
let secretsCache: { map: Map<string, string>; at: number } | null = null;

async function loadProviderSecrets(): Promise<Map<string, string>> {
  if (secretsCache && Date.now() - secretsCache.at < 30_000) return secretsCache.map;
  const map = new Map<string, string>();
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("ai_provider_secrets")
      .select("ciphertext, ai_providers(env_key_var)");
    for (const row of (data ?? []) as unknown as {
      ciphertext: string;
      ai_providers: { env_key_var: string } | { env_key_var: string }[] | null;
    }[]) {
      const prov = Array.isArray(row.ai_providers) ? row.ai_providers[0] : row.ai_providers;
      const envVar = prov?.env_key_var;
      if (!envVar) continue;
      const plain = decryptSecret(row.ciphertext);
      if (plain && plain.trim() !== "") map.set(envVar, plain);
    }
  } catch (err) {
    // table missing / decrypt failure (e.g. wrong AI_SECRETS_KEY) → env-var
    // fallback only. Surface a redacted signal so a silent fallback is noticed;
    // never log key material.
    redactedLogger.warn("loadProviderSecrets failed — falling back to env vars", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  secretsCache = { map, at: Date.now() };
  return map;
}

function envKeyWith(secrets: Map<string, string>, name: string): string | null {
  const fromDb = secrets.get(name);
  if (fromDb && fromDb.trim() !== "") return fromDb;
  const v = process.env[name];
  return v && v.trim() !== "" ? v : null;
}

// Build per-request gateway deps bound to this request's resolved secrets map.
function makeDeps(secrets: Map<string, string>): GatewayDeps {
  return { loadFeatureConfig, envKey: (name) => envKeyWith(secrets, name), logCall };
}

async function logCall(record: AiCallLog): Promise<void> {
  try {
    // ai_calls has no INSERT policy (logging is service-role only by design),
    // so the user-scoped client is denied by RLS. Use the admin client.
    const supabase = createSupabaseAdminClient();
    await supabase.from("ai_calls").insert({
      user_id: record.user_id,
      feature: record.feature,
      model_id: record.model_id,
      provider_slug: record.provider_slug,
      model_string: record.model_string,
      input_tokens: record.input_tokens,
      output_tokens: record.output_tokens,
      total_cost_usd: record.total_cost_usd,
      latency_ms: record.latency_ms,
      status: record.status,
      error_message: record.error_message,
      request_excerpt: record.request_excerpt,
    });
  } catch (err) {
    // Logging failure must never break a request.
    redactedLogger.warn("ai_calls insert failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const deps = makeDeps(await loadProviderSecrets());
  return gatewayChat(req, deps);
}

export async function* chatStream(req: ChatRequest): AsyncGenerator<string, ChatResponse, void> {
  const deps = makeDeps(await loadProviderSecrets());
  return yield* gatewayChatStream(req, deps);
}

export async function embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  const deps = makeDeps(await loadProviderSecrets());
  return gatewayEmbed(req, deps);
}

export async function parseFoodFromImage(
  opts: ParseFoodFromImageOpts,
): Promise<ParseFoodFromImageResult> {
  const deps = makeDeps(await loadProviderSecrets());
  return gatewayParseFood(opts, deps);
}

export async function parseLabsFromContent(opts: ParseLabsOpts): Promise<ParseLabsResult> {
  const deps = makeDeps(await loadProviderSecrets());
  return gatewayParseLabs(opts, deps);
}

export async function generateStack(opts: GenerateStackOpts): Promise<GenerateStackResult> {
  const deps = makeDeps(await loadProviderSecrets());
  return gatewayGenerateStack(opts, deps);
}

/** Resolve a provider's key (admin-set secret or env var) — for admin status/tests. */
export async function resolveProviderKey(envKeyVar: string): Promise<string | null> {
  const secrets = await loadProviderSecrets();
  return envKeyWith(secrets, envKeyVar);
}

export { loadFeatureConfig };
