// Phase 11: photo food logging — confirm step.
// Bulk-inserts the user-confirmed items as food_logs rows (with log_source='photo'
// and photo_asset_id back-reference), then marks the asset confirmed_at.

import { AppError, foodPhotoConfirmInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { asset_id, items } = await parseJson(req, foodPhotoConfirmInput);

    const supabase = await createSupabaseServerClient();

    // Verify asset belongs to user (RLS will also enforce on the update below).
    const { data: asset, error: assetErr } = await supabase
      .from("food_photo_assets")
      .select("id, confirmed_at")
      .eq("id", asset_id)
      .single();

    if (assetErr || !asset) {
      throw new AppError("NOT_FOUND", "Photo asset not found");
    }
    if (asset.confirmed_at) {
      throw new AppError(
        "VALIDATION_FAILED",
        "This photo session was already confirmed",
      );
    }

    const now = new Date().toISOString();
    const rows = items.map((item) => ({
      user_id: user.id,
      description: item.description,
      brand: item.brand ?? null,
      source: item.source,
      source_id: item.source_id ?? null,
      amount: item.amount,
      unit: item.unit,
      calories_kcal: item.calories_kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fiber_g: item.fiber_g ?? null,
      sugar_g: item.sugar_g ?? null,
      sodium_mg: item.sodium_mg ?? null,
      meal_type: item.meal_type ?? null,
      logged_at: (item.logged_at ?? new Date()).toISOString(),
      log_source: "photo" as const,
      photo_asset_id: asset_id,
      note: item.note ?? null,
    }));

    const { data: logs, error } = await supabase
      .from("food_logs")
      .insert(rows)
      .select("id");

    if (error) throw error;

    await supabase
      .from("food_photo_assets")
      .update({ confirmed_at: now, updated_at: now })
      .eq("id", asset_id);

    return jsonOk({
      asset_id,
      logged_count: logs?.length ?? 0,
      log_ids: logs?.map((l) => l.id) ?? [],
    });
  } catch (err) {
    return jsonError(err);
  }
}
