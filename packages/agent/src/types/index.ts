// Shared types for the AI gateway client.

export const FEATURES = [
  "coach",
  "vision",
  "embeddings",
  "insights",
  "stacker",
  "transcribe",
] as const;
export type Feature = (typeof FEATURES)[number];

export const PROVIDER_KINDS = [
  "vercel_gateway",
  "openrouter",
  "voyage",
  "direct",
  "openai",
  "anthropic",
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export interface ModelRow {
  id: string;
  model_id: string;
  display_name: string;
  modality: "chat" | "vision" | "embedding";
  context_window: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  provider_slug: string;
  provider_kind: ProviderKind;
  env_key_var: string;
}

export interface FeatureConfig {
  feature: Feature;
  primary: ModelRow;
  fallbacks: ModelRow[];
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatContent = string | ChatContentPart[];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface ChatRequest {
  feature: Feature;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  userId?: string; // for usage logging
}

export interface ChatResponse {
  text: string;
  model: string;          // provider/model_id that actually answered
  provider_slug: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  used_fallback: boolean;
}

export interface EmbeddingRequest {
  feature: "embeddings";
  input: string | string[];
  userId?: string;
}

export interface EmbeddingResponse {
  vectors: number[][];
  model: string;
  provider_slug: string;
  input_tokens: number;
  latency_ms: number;
}
