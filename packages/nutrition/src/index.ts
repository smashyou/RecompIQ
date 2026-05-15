// Nutrition lookup adapters. Implementation lands in Phase 4.
// Adapter chain: USDA FDC → Open Food Facts → Nutritionix (fallback).

export interface NutritionFacts {
  source: "usda" | "openfoodfacts" | "nutritionix";
  sourceId: string;
  description: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  servingSizeG: number | null;
}

export async function searchFood(_query: string): Promise<NutritionFacts[]> {
  throw new Error("searchFood: not implemented yet (Phase 4)");
}

export async function lookupBarcode(_upc: string): Promise<NutritionFacts | null> {
  throw new Error("lookupBarcode: not implemented yet (Phase 4)");
}
