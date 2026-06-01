import "server-only";
import {
  chat as gatewayChat,
  embed as gatewayEmbed,
  parseFoodFromImage as gatewayParseFood,
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
} from "@peptide/agent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redactedLogger } from "@peptide/shared";

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
    kind: "vercel_gateway" | "openrouter" | "voyage" | "direct";
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

function envKey(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : null;
}

async function logCall(record: AiCallLog): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
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

const deps: GatewayDeps = { loadFeatureConfig, envKey, logCall };

export function chat(req: ChatRequest): Promise<ChatResponse> {
  return gatewayChat(req, deps);
}

export function embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  return gatewayEmbed(req, deps);
}

export function parseFoodFromImage(
  opts: ParseFoodFromImageOpts,
): Promise<ParseFoodFromImageResult> {
  return gatewayParseFood(opts, deps);
}

export function generateStack(opts: GenerateStackOpts): Promise<GenerateStackResult> {
  return gatewayGenerateStack(opts, deps);
}

export { loadFeatureConfig };
