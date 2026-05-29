// Food photo vision parser — single entry point for "snap a meal" parsing.
// Calls the gateway with feature='vision' so the model selection + fallback
// chain + usage logging is the same as every other AI call in the app.

import { chat } from "./gateway";
import type { GatewayDeps } from "./gateway";
import type { ChatRequest } from "./types/index";
import {
  foodPhotoParseResult,
  type FoodPhotoParseResult,
  type VisionProvider,
  VISION_PROVIDER_DEFAULT_MODEL,
} from "@peptide/shared";

const SYSTEM_PROMPT = `You are a nutrition assistant identifying food items in a user-submitted photo.

Look at the image and identify every distinct food item visible. For each item, estimate the total weight in grams of what's actually shown on the plate or in the container (not a serving-size reference number).

Return ONLY a JSON object that conforms to this schema. No prose, no markdown code fences:

{
  "items": [
    {
      "name": "string (specific food name, no brand here)",
      "brand": "string or null (only if a brand is clearly visible on packaging)",
      "estimated_grams": number (total grams of the portion shown),
      "serving_count": number or null (only when a discrete count makes sense, e.g. 2 eggs, 3 cookies),
      "confidence": number from 0 to 1 (how sure you are about both identification AND quantity),
      "meal_type_hint": "breakfast" | "lunch" | "dinner" | "snack" or null
    }
  ]
}

Rules:
- Be specific. "Grilled chicken breast" beats "chicken". "Whole-wheat sourdough" beats "bread".
- Skip negligible garnishes (parsley sprig, lemon wedge) unless they're clearly meant to be eaten.
- If the same food appears in multiple places (two chicken breasts), report it as ONE item with the combined grams.
- If you cannot identify a region with confidence above 0.4, omit it rather than guess.
- For drinks in opaque containers (a closed bottle, an opaque mug), cap confidence at 0.3.
- Maximum 20 items.`;

export interface ParseFoodFromImageOpts {
  imageUrl: string;
  userId?: string;
  userProvider?: VisionProvider; // onboarding preference
  modelOverride?: string;        // explicit override; bypasses preference + feature config primary
}

export interface ParseFoodFromImageResult {
  result: FoodPhotoParseResult;
  modelUsed: string;
  providerUsed: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function parseFoodFromImage(
  opts: ParseFoodFromImageOpts,
  deps: GatewayDeps,
): Promise<ParseFoodFromImageResult> {
  // Build the request. The gateway routes by feature='vision' (config seeded
  // in Phase 9a). userProvider / modelOverride don't directly change routing
  // today; they're carried for future use and for the parsed_items.vision_provider
  // column. The active model gets reflected back in `modelUsed` so the route
  // can persist what actually answered.
  void opts.userProvider;
  void opts.modelOverride;

  const req: ChatRequest = {
    feature: "vision",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify the food in this photo." },
          { type: "image_url", image_url: { url: opts.imageUrl } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.2,
    userId: opts.userId,
  };

  const response = await chat(req, deps);

  const cleaned = response.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Vision response was not valid JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  const validated = foodPhotoParseResult.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Vision response failed schema validation: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 3)
        .join("; ")}`,
    );
  }

  return {
    result: validated.data,
    modelUsed: response.model,
    providerUsed: response.provider_slug,
    inputTokens: response.input_tokens,
    outputTokens: response.output_tokens,
    latencyMs: response.latency_ms,
  };
}

// Helper: pick a model string for a given onboarding provider preference.
// Returned for diagnostic / persistence purposes; gateway routing already
// uses the feature config.
export function modelForProvider(provider: VisionProvider | null | undefined): string {
  if (!provider) return VISION_PROVIDER_DEFAULT_MODEL.anthropic;
  return VISION_PROVIDER_DEFAULT_MODEL[provider];
}
