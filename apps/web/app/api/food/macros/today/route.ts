import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const today = new Date().toISOString().slice(0, 10);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("food_logs")
      .select("calories_kcal,protein_g,carbs_g,fat_g,fiber_g")
      .eq("user_id", user.id)
      .gte("logged_at", `${today}T00:00:00`)
      .lte("logged_at", `${today}T23:59:59.999`);
    if (error) throw error;

    const totals = (data ?? []).reduce(
      (acc, row) => ({
        calories_kcal: acc.calories_kcal + Number(row.calories_kcal),
        protein_g: acc.protein_g + Number(row.protein_g),
        carbs_g: acc.carbs_g + Number(row.carbs_g),
        fat_g: acc.fat_g + Number(row.fat_g),
        fiber_g: acc.fiber_g + Number(row.fiber_g ?? 0),
      }),
      { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    );
    return jsonOk({ date: today, totals, log_count: data?.length ?? 0 });
  } catch (err) {
    return jsonError(err);
  }
}
