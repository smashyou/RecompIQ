// Phase 11: photo food logging — parse step.
// Calls the gateway vision model on the uploaded asset, persists parsed items,
// and attaches a top-3 USDA/OFF suggestion list for each item so the review UI
// can render them with one network call.

import { searchFood, type NutritionFacts } from "@peptide/nutrition";
import {
  AppError,
  foodPhotoParseInput,
  type ParsedFoodItem,
} from "@peptide/shared";
import { modelForProvider } from "@peptide/agent";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { parseFoodFromImage } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ParsedItemWithSuggestions extends ParsedFoodItem {
  suggestions: NutritionFacts[];
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { asset_id, model } = await parseJson(req, foodPhotoParseInput);

    const supabase = await createSupabaseServerClient();

    // Load asset (RLS already gates to current user)
    const { data: asset, error: assetErr } = await supabase
      .from("food_photo_assets")
      .select("id, blob_url, parsed_at, parsed_items, vision_provider, vision_model")
      .eq("id", asset_id)
      .single();

    if (assetErr || !asset) {
      throw new AppError("NOT_FOUND", "Photo asset not found");
    }

    // Load user's preferred vision provider from user_settings (set during onboarding)
    const { data: settings } = await supabase
      .from("user_settings")
      .select("vision_provider")
      .eq("user_id", user.id)
      .maybeSingle();

    const userProvider = (settings?.vision_provider ?? "anthropic") as
      | "anthropic"
      | "openai"
      | "google";

    let parseResult;
    try {
      parseResult = await parseFoodFromImage({
        imageUrl: asset.blob_url,
        userId: user.id,
        userProvider,
        modelOverride: model,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Persist the error for diagnostics, then return a typed envelope so the UI
      // can switch to manual-entry mode.
      await supabase
        .from("food_photo_assets")
        .update({
          parse_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset_id);
      throw new AppError(
        "UPSTREAM_FAILED",
        `Vision parse failed: ${message.slice(0, 200)}`,
      );
    }

    // Attach top-3 USDA/OFF matches per item. Best-effort: nutrition adapters
    // already swallow upstream errors and return [].
    const itemsWithSuggestions: ParsedItemWithSuggestions[] = await Promise.all(
      parseResult.result.items.map(async (item) => {
        const matches = await searchFood({ query: item.name, limit: 3 }).catch(
          () => [] as NutritionFacts[],
        );
        return { ...item, suggestions: matches };
      }),
    );

    // Persist the parse result (without the heavy suggestions blob — those are
    // ephemeral and can be re-fetched).
    await supabase
      .from("food_photo_assets")
      .update({
        parsed_items: parseResult.result.items,
        parsed_at: new Date().toISOString(),
        vision_provider: parseResult.providerUsed,
        vision_model: parseResult.modelUsed,
        parse_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset_id);

    return jsonOk({
      asset_id,
      items: itemsWithSuggestions,
      model_used: parseResult.modelUsed,
      provider_used: parseResult.providerUsed,
      user_provider_preference: modelForProvider(userProvider),
    });
  } catch (err) {
    return jsonError(err);
  }
}
