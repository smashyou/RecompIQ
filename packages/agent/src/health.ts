// Provider health check — a minimal live call to verify a provider's API key +
// reachability, used by the admin "Test connection" button. Independent of the
// feature-config routing in gateway.ts so it can probe any single provider.

import { CHAT_PROVIDERS, EMBEDDING_PROVIDERS } from "./providers/index";
import type { ModelRow, ProviderKind } from "./types/index";

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface PingProviderOpts {
  kind: ProviderKind;
  providerSlug: string;
  modelId: string; // a representative model id for this provider
  apiKey: string;
}

export async function pingProvider(opts: PingProviderOpts): Promise<PingResult> {
  const model: ModelRow = {
    id: "ping",
    model_id: opts.modelId,
    display_name: "ping",
    modality: "chat",
    context_window: null,
    input_cost_per_1m: null,
    output_cost_per_1m: null,
    provider_slug: opts.providerSlug,
    provider_kind: opts.kind,
    env_key_var: "",
  };

  const t0 = Date.now();
  try {
    const chatExec = CHAT_PROVIDERS[opts.kind];
    if (chatExec) {
      await chatExec(
        {
          feature: "vision",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
          temperature: 0,
        },
        model,
        opts.apiKey,
      );
      return { ok: true, latencyMs: Date.now() - t0 };
    }
    const embExec = EMBEDDING_PROVIDERS[opts.kind];
    if (embExec) {
      await embExec({ feature: "embeddings", input: "ping" }, model, opts.apiKey);
      return { ok: true, latencyMs: Date.now() - t0 };
    }
    return { ok: false, latencyMs: Date.now() - t0, error: `No adapter for kind ${opts.kind}` };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    };
  }
}
