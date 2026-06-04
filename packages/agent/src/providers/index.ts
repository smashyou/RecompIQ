// Provider adapters. Each takes a normalized request + raw API key and returns
// a normalized response. Routing decisions happen one layer up in gateway.ts.

import type {
  ChatContent,
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
// OpenAI direct — native /v1/chat/completions. image_url parts work natively,
// so the OpenAI-compatible adapter handles text + vision unchanged.
// ---------------------------------------------------------------------------
const chatOpenAIDirect: ChatExec = (req, model, apiKey) =>
  chatOpenAILike("https://api.openai.com/v1", req, model, apiKey);

// ---------------------------------------------------------------------------
// Anthropic direct — native Messages API. Translates the OpenAI-style request:
//   - system messages → top-level `system` string
//   - image_url parts → { type:'image', source:{ type:'url', url } }
//   - response content blocks → concatenated text
// ---------------------------------------------------------------------------
interface AnthropicBlock {
  type: "text" | "image";
  text?: string;
  source?: { type: "url"; url: string };
}
// Translates the OpenAI-style request into an Anthropic Messages body
// (system → top-level string, image_url → image blocks). Shared by the
// non-streaming and streaming adapters.
function buildAnthropicBody(req: ChatRequest, model: ModelRow): Record<string, unknown> {
  const systemText = req.messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n\n")
    .trim();
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content };
      }
      const blocks: AnthropicBlock[] = m.content.map((part) =>
        part.type === "text"
          ? { type: "text", text: part.text }
          : { type: "image", source: { type: "url", url: part.image_url.url } },
      );
      return { role: m.role, content: blocks };
    });
  return {
    model: model.model_id,
    max_tokens: req.max_tokens ?? 1024,
    temperature: req.temperature ?? 0.7,
    ...(systemText ? { system: systemText } : {}),
    messages,
  };
}

const chatAnthropicDirect: ChatExec = async (req, model, apiKey) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildAnthropicBody(req, model)),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`anthropic ${model.model_id}: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = body.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  return {
    text,
    model: model.model_id,
    provider_slug: model.provider_slug,
    input_tokens: body.usage?.input_tokens ?? 0,
    output_tokens: body.usage?.output_tokens ?? 0,
  };
};

// ---------------------------------------------------------------------------
// Google Gemini direct — native generateContent. system → system_instruction,
// assistant → role "model". Text-only here (the coach is text; vision uses gpt-4o).
// ---------------------------------------------------------------------------
function geminiText(content: ChatContent): string {
  return typeof content === "string"
    ? content
    : content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .trim();
}
function buildGeminiBody(req: ChatRequest, _model: ModelRow): Record<string, unknown> {
  const systemText = req.messages
    .filter((m) => m.role === "system")
    .map((m) => geminiText(m.content))
    .join("\n\n")
    .trim();
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: geminiText(m.content) }],
    }));
  return {
    ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: req.max_tokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    },
  };
}

const chatGoogleDirect: ChatExec = async (req, model, apiKey) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiBody(req, model)),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google ${model.model_id}: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  return {
    text,
    model: model.model_id,
    provider_slug: model.provider_slug,
    input_tokens: body.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
};

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
  openai: chatOpenAIDirect,
  anthropic: chatAnthropicDirect,
  google: chatGoogleDirect,
};

export const EMBEDDING_PROVIDERS: Record<ProviderKind, EmbeddingExec | null> = {
  vercel_gateway: null,
  openrouter: null,
  voyage: embedVoyage,
  direct: null,
  openai: null,
  anthropic: null,
  google: null,
};

// ---------------------------------------------------------------------------
// Streaming adapters. Each is an async generator that YIELDS text deltas and
// RETURNS the final usage/metadata. The gateway walks the fallback chain the
// same way as non-streaming, but can only fall back BEFORE the first token.
// ---------------------------------------------------------------------------
export type ChatStreamResult = Omit<ChatResponse, "used_fallback" | "latency_ms">;
export interface ChatStreamExec {
  (req: ChatRequest, model: ModelRow, apiKey: string): AsyncGenerator<string, ChatStreamResult, void>;
}

// Reads a Server-Sent-Events body and yields each event's concatenated `data:` payload.
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const evt = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const data = evt
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// OpenAI-compatible streaming (OpenAI, OpenRouter, Vercel Gateway).
async function* chatStreamOpenAILike(
  baseUrl: string,
  req: ChatRequest,
  model: ModelRow,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): AsyncGenerator<string, ChatStreamResult, void> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({
      model: model.model_id,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 1024,
      temperature: req.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`${model.provider_slug} ${model.model_id}: ${res.status} ${t.slice(0, 300)}`);
  }
  let full = "";
  let inTok = 0;
  let outTok = 0;
  for await (const data of sseData(res.body)) {
    if (data === "[DONE]") break;
    try {
      const j = JSON.parse(data) as {
        choices?: { delta?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const delta = j.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        yield delta;
      }
      if (j.usage) {
        inTok = j.usage.prompt_tokens ?? inTok;
        outTok = j.usage.completion_tokens ?? outTok;
      }
    } catch {
      // ignore non-JSON / partial keep-alive lines
    }
  }
  return { text: full, model: model.model_id, provider_slug: model.provider_slug, input_tokens: inTok, output_tokens: outTok };
}

// Anthropic Messages streaming.
async function* chatStreamAnthropicDirect(
  req: ChatRequest,
  model: ModelRow,
  apiKey: string,
): AsyncGenerator<string, ChatStreamResult, void> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ ...buildAnthropicBody(req, model), stream: true }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`anthropic ${model.model_id}: ${res.status} ${t.slice(0, 300)}`);
  }
  let full = "";
  let inTok = 0;
  let outTok = 0;
  for await (const data of sseData(res.body)) {
    try {
      const j = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { usage?: { input_tokens?: number } };
        usage?: { output_tokens?: number };
      };
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
        full += j.delta.text;
        yield j.delta.text;
      } else if (j.type === "message_start") {
        inTok = j.message?.usage?.input_tokens ?? inTok;
      } else if (j.type === "message_delta") {
        outTok = j.usage?.output_tokens ?? outTok;
      }
    } catch {
      // ignore
    }
  }
  return { text: full, model: model.model_id, provider_slug: model.provider_slug, input_tokens: inTok, output_tokens: outTok };
}

// Google Gemini streaming (SSE via ?alt=sse).
async function* chatStreamGoogleDirect(
  req: ChatRequest,
  model: ModelRow,
  apiKey: string,
): AsyncGenerator<string, ChatStreamResult, void> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiBody(req, model)),
    },
  );
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`google ${model.model_id}: ${res.status} ${t.slice(0, 300)}`);
  }
  let full = "";
  let inTok = 0;
  let outTok = 0;
  for await (const data of sseData(res.body)) {
    try {
      const j = JSON.parse(data) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      for (const p of j.candidates?.[0]?.content?.parts ?? []) {
        if (p.text) {
          full += p.text;
          yield p.text;
        }
      }
      if (j.usageMetadata) {
        inTok = j.usageMetadata.promptTokenCount ?? inTok;
        outTok = j.usageMetadata.candidatesTokenCount ?? outTok;
      }
    } catch {
      // ignore
    }
  }
  return { text: full, model: model.model_id, provider_slug: model.provider_slug, input_tokens: inTok, output_tokens: outTok };
}

export const CHAT_STREAM_PROVIDERS: Record<ProviderKind, ChatStreamExec | null> = {
  vercel_gateway: (req, m, k) => chatStreamOpenAILike("https://gateway.ai.vercel.com/v1", req, m, k),
  openrouter: (req, m, k) =>
    chatStreamOpenAILike("https://openrouter.ai/api/v1", req, m, k, {
      "HTTP-Referer": "https://recompiq.vercel.app",
      "X-Title": "RecompIQ",
    }),
  voyage: null,
  direct: null,
  openai: (req, m, k) => chatStreamOpenAILike("https://api.openai.com/v1", req, m, k),
  anthropic: chatStreamAnthropicDirect,
  google: chatStreamGoogleDirect,
};
