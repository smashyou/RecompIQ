import { foodLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, foodLogInput);
    const loggedAt = data.logged_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { error, data: row } = await supabase
      .from("food_logs")
      .insert({
        user_id: user.id,
        description: data.description,
        brand: data.brand ?? null,
        source: data.source,
        source_id: data.source_id ?? null,
        amount: data.amount,
        unit: data.unit,
        calories_kcal: data.calories_kcal,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g ?? null,
        sugar_g: data.sugar_g ?? null,
        sodium_mg: data.sodium_mg ?? null,
        meal_type: data.meal_type ?? null,
        logged_at: loggedAt.toISOString(),
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59.999`;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: true });
    if (error) throw error;
    return jsonOk({ date, logs: data ?? [] });
  } catch (err) {
    return jsonError(err);
  }
}
