import { z } from "zod";

export const FOOD_UNIT = ["g", "oz", "ml", "cup", "tbsp", "tsp", "serving", "piece"] as const;
export type FoodUnit = (typeof FOOD_UNIT)[number];

export const MEAL_TYPE = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPE)[number];

export const FOOD_SOURCE = ["usda", "openfoodfacts", "nutritionix", "custom"] as const;
export type FoodSource = (typeof FOOD_SOURCE)[number];

export const foodLogInput = z.object({
  description: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable().optional(),
  source: z.enum(FOOD_SOURCE),
  source_id: z.string().max(120).nullable().optional(),
  amount: z.number().positive().max(10000),
  unit: z.enum(FOOD_UNIT),
  calories_kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(500),
  fiber_g: z.number().min(0).max(200).nullable().optional(),
  sugar_g: z.number().min(0).max(500).nullable().optional(),
  sodium_mg: z.number().min(0).max(20000).nullable().optional(),
  meal_type: z.enum(MEAL_TYPE).nullable().optional(),
  logged_at: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).nullable().optional(),
});
export type FoodLogInput = z.infer<typeof foodLogInput>;

export const foodSearchQuery = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
