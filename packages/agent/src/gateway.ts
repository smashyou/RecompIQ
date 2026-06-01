// AI gateway client — single entry point for all model calls in the app.
//
// Pipeline:
//   1. Resolve feature config (primary + fallback chain) from the DB.
//   2. Try primary → on error, walk fallbacks.
//   3. Log every call to ai_calls for cost tracking.
//
// This file is the only place that knows how to dispatch to a provider; all
// other code in the app should import `chat` or `embed` from here and pass
// a feature key. Direct provider SDK imports elsewhere are forbidden by
// convention (and called out in CLAUDE.md).

import { CHAT_PROVIDERS, EMBEDDING_PROVIDERS } from "./providers/index";
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  Feature,
  FeatureConfig,
  ModelRow,
} from "./types/index";

export * from "./types/index";

// ---------------------------------------------------------------------------
// Caller injects a DB client + env getter so this package stays runtime-agnostic.
// ---------------------------------------------------------------------------
export interface GatewayDeps {
  // Loads the primary + fallback model rows for a given feature.
  loadFeatureConfig(feature: Feature): Promise<FeatureConfig | null>;
  // Returns the API key for a given env-var name (or null if missing).
  envKey(name: string): string | null | undefined;
  // Persists a call record. Best-effort; failures here don't fail the request.
  logCall(record: AiCallLog): Promise<void>;
}

export interface AiCallLog {
  user_id?: string | null;
  feature: Feature;
  model_id: string;        // ai_models.id (uuid) of the model that ANSWERED
  provider_slug: string;
  model_string: string;    // model_id text on that row
  input_tokens: number;
  output_tokens: number;
  total_cost_usd: number | null;
  latency_ms: number;
  status: "ok" | "error" | "fallback";
  error_message: string | null;
  request_excerpt: string | null;
}

const REQUEST_EXCERPT_MAX = 200;

function excerpt(req: ChatRequest | EmbeddingRequest): string {
  if ("messages" in req) {
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const content = lastUser?.content ?? "";
    const text =
      typeof content === "string"
        ? content
        : content
            .map((part) => (part.type === "text" ? part.text : "[image]"))
            .join(" ");
    return text.slice(0, REQUEST_EXCERPT_MAX);
  }
  const input = Array.isArray(req.input) ? req.input[0] ?? "" : req.input;
  return input.slice(0, REQUEST_EXCERPT_MAX);
}

function costFor(model: ModelRow, inputTok: number, outputTok: number): number | null {
  const inCost = model.input_cost_per_1m;
  const outCost = model.output_cost_per_1m;
  if (inCost === null) return null;
  const inUsd = (inputTok / 1_000_000) * inCost;
  const outUsd = outCost !== null ? (outputTok / 1_000_000) * outCost : 0;
  return Number((inUsd + outUsd).toFixed(6));
}

// ---------------------------------------------------------------------------
// chat — primary entry for text generation
// ---------------------------------------------------------------------------
export async function chat(
  req: ChatRequest,
  deps: GatewayDeps,
): Promise<ChatResponse> {
  const config = await deps.loadFeatureConfig(req.feature);
  if (!config) throw new Error(`No feature config for ${req.feature}`);

  const chain: { model: ModelRow; isPrimary: boolean }[] = [
    { model: config.primary, isPrimary: true },
    ...config.fallbacks.map((m) => ({ model: m, isPrimary: false })),
  ];

  let lastError: Error | null = null;
  for (const { model, isPrimary } of chain) {
    const exec = CHAT_PROVIDERS[model.provider_kind as keyof typeof CHAT_PROVIDERS];
    if (!exec) {
      lastError = new Error(`No chat adapter for provider kind ${model.provider_kind}`);
      continue;
    }
    const apiKey = deps.envKey(model.env_key_var);
    if (!apiKey) {
      lastError = new Error(`Missing API key (${model.env_key_var}) for ${model.provider_slug}`);
      continue;
    }

    const t0 = Date.now();
    try {
      const result = await exec(req, model, apiKey);
      const latency_ms = Date.now() - t0;
      await deps.logCall({
        user_id: req.userId ?? null,
        feature: req.feature,
        model_id: model.id,
        provider_slug: model.provider_slug,
        model_string: model.model_id,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        total_cost_usd: costFor(model, result.input_tokens, result.output_tokens),
        latency_ms,
        status: isPrimary ? "ok" : "fallback",
        error_message: null,
        request_excerpt: excerpt(req),
      });
      return {
        ...result,
        latency_ms,
        used_fallback: !isPrimary,
      };
    } catch (err) {
      const latency_ms = Date.now() - t0;
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);
      await deps.logCall({
        user_id: req.userId ?? null,
        feature: req.feature,
        model_id: model.id,
        provider_slug: model.provider_slug,
        model_string: model.model_id,
        input_tokens: 0,
        output_tokens: 0,
        total_cost_usd: null,
        latency_ms,
        status: "error",
        error_message: message.slice(0, 500),
        request_excerpt: excerpt(req),
      });
      // continue to next fallback
    }
  }
  throw lastError ?? new Error(`All chat providers failed for feature ${req.feature}`);
}

// ---------------------------------------------------------------------------
// embed — text embeddings (RAG, similarity)
// ---------------------------------------------------------------------------
export async function embed(
  req: EmbeddingRequest,
  deps: GatewayDeps,
): Promise<EmbeddingResponse> {
  const config = await deps.loadFeatureConfig("embeddings");
  if (!config) throw new Error("No feature config for embeddings");

  const chain: { model: ModelRow; isPrimary: boolean }[] = [
    { model: config.primary, isPrimary: true },
    ...config.fallbacks.map((m) => ({ model: m, isPrimary: false })),
  ];

  let lastError: Error | null = null;
  for (const { model, isPrimary } of chain) {
    const exec = EMBEDDING_PROVIDERS[model.provider_kind as keyof typeof EMBEDDING_PROVIDERS];
    if (!exec) {
      lastError = new Error(`No embedding adapter for provider kind ${model.provider_kind}`);
      continue;
    }
    const apiKey = deps.envKey(model.env_key_var);
    if (!apiKey) {
      lastError = new Error(`Missing API key (${model.env_key_var}) for ${model.provider_slug}`);
      continue;
    }
    const t0 = Date.now();
    try {
      const result = await exec(req, model, apiKey);
      const latency_ms = Date.now() - t0;
      await deps.logCall({
        user_id: req.userId ?? null,
        feature: "embeddings",
        model_id: model.id,
        provider_slug: model.provider_slug,
        model_string: model.model_id,
        input_tokens: result.input_tokens,
        output_tokens: 0,
        total_cost_usd: costFor(model, result.input_tokens, 0),
        latency_ms,
        status: isPrimary ? "ok" : "fallback",
        error_message: null,
        request_excerpt: excerpt(req),
      });
      return { ...result, latency_ms };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);
      await deps.logCall({
        user_id: req.userId ?? null,
        feature: "embeddings",
        model_id: model.id,
        provider_slug: model.provider_slug,
        model_string: model.model_id,
        input_tokens: 0,
        output_tokens: 0,
        total_cost_usd: null,
        latency_ms: Date.now() - t0,
        status: "error",
        error_message: message.slice(0, 500),
        request_excerpt: excerpt(req),
      });
    }
  }
  throw lastError ?? new Error("All embedding providers failed");
}

// Legacy export retained for any older imports.
export const MODELS = {
  coachDefault: "anthropic/claude-sonnet-4-6",
  coachFallback: "openai/gpt-5",
  coachLite: "anthropic/claude-haiku-4-5",
  visionOpenAI: "openai/gpt-4o",
  visionGemini: "google/gemini-2.5-flash",
  visionClaude: "anthropic/claude-sonnet-4-6",
  embed: "voyage/voyage-3-large",
} as const;
