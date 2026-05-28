// Provider adapters. Each takes a normalized request + raw API key and returns
// a normalized response. Routing decisions happen one layer up in gateway.ts.

import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelRow,
  ProviderKind,
} from "../types/index";

interface ChatExec {
  (req: ChatRequest, model: ModelRow, apiKey: string): Promise<Omit<
    ChatResponse,
    "used_fallback" | "latency_ms"
  >>;
}

interface EmbeddingExec {
  (req: EmbeddingRequest, model: ModelRow, apiKey: string): Promise<Omit<
    EmbeddingResponse,
    "latency_ms"
  >>;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible /v1/chat/completions (Vercel Gateway, OpenRouter, OpenAI)
// ---------------------------------------------------------------------------
async function chatOpenAILike(
  baseUrl: string,
  req: ChatRequest,
  model: ModelRow,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): Promise<Omit<ChatResponse, "used_fallback" | "latency_ms">> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: model.model_id,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${model.provider_slug} ${model.model_id}: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: body.choices[0]?.message.content ?? "",
    model: model.model_id,
    provider_slug: model.provider_slug,
    input_tokens: body.usage?.prompt_tokens ?? 0,
    output_tokens: body.usage?.completion_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Vercel AI Gateway — OpenAI-compatible at https://gateway.ai.vercel.com/v1
// ---------------------------------------------------------------------------
const chatVercelGateway: ChatExec = (req, model, apiKey) =>
  chatOpenAILike("https://gateway.ai.vercel.com/v1", req, model, apiKey);

// ---------------------------------------------------------------------------
// OpenRouter — OpenAI-compatible at https://openrouter.ai/api/v1
// Adds attribution headers per OpenRouter best practices.
// ---------------------------------------------------------------------------
const chatOpenRouter: ChatExec = (req, model, apiKey) =>
  chatOpenAILike("https://openrouter.ai/api/v1", req, model, apiKey, {
    "HTTP-Referer": "https://recompiq.vercel.app",
    "X-Title": "RecompIQ",
  });

// ---------------------------------------------------------------------------
// Voyage AI — embeddings at https://api.voyageai.com/v1
// ---------------------------------------------------------------------------
const embedVoyage: EmbeddingExec = async (req, model, apiKey) => {
  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.model_id,
      input: inputs,
      input_type: "document",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`voyage ${model.model_id}: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    data: { embedding: number[] }[];
    usage?: { total_tokens?: number };
  };
  return {
    vectors: body.data.map((d) => d.embedding),
    model: model.model_id,
    provider_slug: model.provider_slug,
    input_tokens: body.usage?.total_tokens ?? 0,
  };
};

export const CHAT_PROVIDERS: Record<ProviderKind, ChatExec | null> = {
  vercel_gateway: chatVercelGateway,
  openrouter: chatOpenRouter,
  voyage: null,
  direct: null,
};

export const EMBEDDING_PROVIDERS: Record<ProviderKind, EmbeddingExec | null> = {
  vercel_gateway: null,
  openrouter: null,
  voyage: embedVoyage,
  direct: null,
};
