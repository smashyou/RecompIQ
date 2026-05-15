// Single chokepoint for AI provider routing via Vercel AI Gateway.
// All chat / vision / embed calls in the app go through this file.
// Direct provider SDK imports elsewhere in the codebase are forbidden.

export const MODELS = {
  coachDefault: "anthropic/claude-sonnet-4-6",
  coachFallback: "openai/gpt-5",
  coachLite: "anthropic/claude-haiku-4-5",
  visionOpenAI: "openai/gpt-4o",
  visionGemini: "google/gemini-2.5-flash",
  visionClaude: "anthropic/claude-sonnet-4-6",
  embed: "openai/text-embedding-3-small",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// Implementation lands in Phase 9. This stub keeps the API surface stable.
export function modelFor(key: ModelKey): ModelId {
  return MODELS[key];
}
