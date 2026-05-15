// Nutrition lookup with provider chain. Source of truth for portion + macro math.
// USDA FoodData Central → Open Food Facts (no key needed) fallback.

export type NutritionSource = "usda" | "openfoodfacts" | "nutritionix" | "custom";

export interface NutritionFacts {
  source: NutritionSource;
  sourceId: string; // fdc_id, barcode, or custom uuid
  description: string;
  brand: string | null;
  // Per 100 g (or "per serving" for branded items that don't disclose 100g).
  basis: "per_100g" | "per_serving";
  servingSizeG: number | null; // grams in one "serving" (when basis = per_serving)
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
}

const G_PER_OZ = 28.3495;
const G_PER_ML = 1.0; // water-equivalent approximation; refined by source when available

export type FoodUnit =
  | "g"
  | "oz"
  | "ml"
  | "cup"
  | "tbsp"
  | "tsp"
  | "serving"
  | "piece";

export interface PortionInput {
  amount: number;
  unit: FoodUnit;
}

export interface MacroPayload {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
}

// Compute the grams represented by a (amount, unit) pair for a given food.
// Falls back to the food's serving size for non-mass units when sensible.
export function gramsFor(food: NutritionFacts, portion: PortionInput): number | null {
  switch (portion.unit) {
    case "g":
      return portion.amount;
    case "oz":
      return portion.amount * G_PER_OZ;
    case "ml":
      return portion.amount * G_PER_ML;
    case "serving":
    case "piece":
      if (food.servingSizeG && food.servingSizeG > 0) return portion.amount * food.servingSizeG;
      return null;
    case "cup":
    case "tbsp":
    case "tsp":
      // Without density data we can't precisely convert volume → mass.
      // Treat as "serving" if a serving size exists, else null (UI shows warning).
      if (food.servingSizeG && food.servingSizeG > 0) return portion.amount * food.servingSizeG;
      return null;
    default:
      return null;
  }
}

// Scale macros from the food's basis (per 100g or per serving) to a portion in grams.
export function macrosForPortion(
  food: NutritionFacts,
  portion: PortionInput,
): MacroPayload | null {
  const grams = gramsFor(food, portion);
  if (grams === null) return null;
  let scale: number;
  if (food.basis === "per_100g") {
    scale = grams / 100;
  } else {
    // per_serving basis. If the unit was "serving", just use amount directly.
    if (portion.unit === "serving") {
      scale = portion.amount;
    } else if (food.servingSizeG && food.servingSizeG > 0) {
      scale = grams / food.servingSizeG;
    } else {
      return null;
    }
  }
  const round = (n: number, d = 1) => Number((n * scale).toFixed(d));
  return {
    calories_kcal: round(food.caloriesKcal, 1),
    protein_g: round(food.proteinG, 1),
    carbs_g: round(food.carbsG, 1),
    fat_g: round(food.fatG, 1),
    fiber_g: food.fiberG !== null ? round(food.fiberG, 1) : null,
    sugar_g: food.sugarG !== null ? round(food.sugarG, 1) : null,
    sodium_mg: food.sodiumMg !== null ? round(food.sodiumMg, 0) : null,
  };
}

// ---------------------------------------------------------------------------
// Provider chain
// ---------------------------------------------------------------------------

interface SearchOptions {
  query: string;
  limit?: number;
  usdaKey?: string;
  fetchImpl?: typeof fetch;
}

export async function searchFood(opts: SearchOptions): Promise<NutritionFacts[]> {
  const f = opts.fetchImpl ?? fetch;
  const limit = opts.limit ?? 10;
  const usdaKey = opts.usdaKey ?? process.env.USDA_FDC_API_KEY ?? "DEMO_KEY";

  // 1. USDA
  try {
    const usda = await searchUsda(opts.query, limit, usdaKey, f);
    if (usda.length > 0) return usda;
  } catch {
    /* fall through */
  }

  // 2. Open Food Facts
  try {
    return await searchOpenFoodFacts(opts.query, limit, f);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// USDA FoodData Central
// ---------------------------------------------------------------------------

const USDA_NUTRIENT_IDS = {
  calories: 1008, // "Energy" kcal
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093, // mg
} as const;

interface UsdaFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientId: number; value: number }[];
  dataType?: string;
}

async function searchUsda(
  query: string,
  limit: number,
  key: string,
  f: typeof fetch,
): Promise<NutritionFacts[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");
  const res = await f(url.toString());
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const body = (await res.json()) as { foods?: UsdaFood[] };
  return (body.foods ?? []).map(normalizeUsda);
}

function nutrientValue(food: UsdaFood, id: number): number | null {
  const n = food.foodNutrients?.find((x) => x.nutrientId === id);
  return n ? n.value : null;
}

function normalizeUsda(food: UsdaFood): NutritionFacts {
  const isBranded = food.dataType === "Branded";
  const servingG =
    food.servingSize && food.servingSizeUnit?.toLowerCase() === "g"
      ? food.servingSize
      : food.servingSize && food.servingSizeUnit?.toLowerCase() === "ml"
        ? food.servingSize
        : null;
  return {
    source: "usda",
    sourceId: String(food.fdcId),
    description: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    basis: isBranded && servingG ? "per_serving" : "per_100g",
    servingSizeG: servingG,
    caloriesKcal: nutrientValue(food, USDA_NUTRIENT_IDS.calories) ?? 0,
    proteinG: nutrientValue(food, USDA_NUTRIENT_IDS.protein) ?? 0,
    carbsG: nutrientValue(food, USDA_NUTRIENT_IDS.carbs) ?? 0,
    fatG: nutrientValue(food, USDA_NUTRIENT_IDS.fat) ?? 0,
    fiberG: nutrientValue(food, USDA_NUTRIENT_IDS.fiber),
    sugarG: nutrientValue(food, USDA_NUTRIENT_IDS.sugar),
    sodiumMg: nutrientValue(food, USDA_NUTRIENT_IDS.sodium),
  };
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string>;
}

async function searchOpenFoodFacts(
  query: string,
  limit: number,
  f: typeof fetch,
): Promise<NutritionFacts[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("json", "1");
  url.searchParams.set(
    "fields",
    "code,product_name,brands,serving_size,serving_quantity,nutriments",
  );
  const res = await f(url.toString(), {
    headers: { "User-Agent": "RecompIQ/0.1 (https://github.com/smashyou/RecompIQ)" },
  });
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  const body = (await res.json()) as { products?: OffProduct[] };
  return (body.products ?? [])
    .filter((p) => p.product_name && p.nutriments)
    .slice(0, limit)
    .map(normalizeOff);
}

function offNumber(n: Record<string, number | string> | undefined, key: string): number {
  const v = n?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeOff(p: OffProduct): NutritionFacts {
  const n = p.nutriments ?? {};
  const sq = typeof p.serving_quantity === "string" ? Number(p.serving_quantity) : p.serving_quantity;
  return {
    source: "openfoodfacts",
    sourceId: p.code,
    description: p.product_name ?? "Unknown",
    brand: p.brands ?? null,
    basis: "per_100g",
    servingSizeG: typeof sq === "number" && sq > 0 ? sq : null,
    caloriesKcal: offNumber(n, "energy-kcal_100g") || offNumber(n, "energy-kcal"),
    proteinG: offNumber(n, "proteins_100g") || offNumber(n, "proteins"),
    carbsG: offNumber(n, "carbohydrates_100g") || offNumber(n, "carbohydrates"),
    fatG: offNumber(n, "fat_100g") || offNumber(n, "fat"),
    fiberG: offNumber(n, "fiber_100g") || null,
    sugarG: offNumber(n, "sugars_100g") || null,
    sodiumMg: (offNumber(n, "sodium_100g") || 0) * 1000 || null, // OFF reports sodium in g
  };
}
