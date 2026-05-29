import { z } from "zod";
import { foodLogInput, MEAL_TYPE } from "./index";
import type { VisionProvider } from "../../enums/index";

// Maps the onboarding vision_provider preference to a Vercel AI Gateway model string.
// Admin panel can still override per-feature via ai_feature_config.feature='food_vision'.
export const VISION_PROVIDER_DEFAULT_MODEL: Record<VisionProvider, string> = {
  anthropic: "anthropic/claude-sonnet-4-6",
  openai: "openai/gpt-4o",
  google: "google/gemini-2.5-flash",
};

export const parsedFoodItem = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable().optional(),
  estimated_grams: z.number().positive().max(5000),
  serving_count: z.number().positive().max(50).nullable().optional(),
  confidence: z.number().min(0).max(1),
  meal_type_hint: z.enum(MEAL_TYPE).nullable().optional(),
});
export type ParsedFoodItem = z.infer<typeof parsedFoodItem>;

export const foodPhotoParseResult = z.object({
  items: z.array(parsedFoodItem).max(20),
});
export type FoodPhotoParseResult = z.infer<typeof foodPhotoParseResult>;

export const foodPhotoParseInput = z.object({
  asset_id: z.string().uuid(),
  model: z.string().max(120).optional(),
});
export type FoodPhotoParseInput = z.infer<typeof foodPhotoParseInput>;

export const foodPhotoConfirmInput = z.object({
  asset_id: z.string().uuid(),
  items: z.array(foodLogInput).min(1).max(20),
});
export type FoodPhotoConfirmInput = z.infer<typeof foodPhotoConfirmInput>;
