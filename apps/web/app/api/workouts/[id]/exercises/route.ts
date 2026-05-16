import { exercisesBatchInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id: workoutId } = await ctx.params;
    const { items } = await parseJson(req, exercisesBatchInput);
    const supabase = await createSupabaseServerClient();

    // Ensure the workout belongs to this user before mutating.
    const ownerCheck = await supabase
      .from("workouts")
      .select("id")
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownerCheck.data) {
      return jsonError(new Error("Workout not found"));
    }

    // Replace existing exercises (delete then insert) so the order_index stays clean.
    await supabase.from("workout_exercises").delete().eq("workout_id", workoutId);

    const rows = items.map((it, idx) => ({
      workout_id: workoutId,
      user_id: user.id,
      order_index: it.order_index ?? idx,
      name: it.name,
      sets: it.sets ?? null,
      reps: it.reps ?? null,
      load_lb: it.load_lb ?? null,
      duration_min: it.duration_min ?? null,
      rpe: it.rpe ?? null,
      notes: it.notes ?? null,
    }));
    const { error } = await supabase.from("workout_exercises").insert(rows);
    if (error) throw error;
    return jsonOk({ inserted: rows.length });
  } catch (err) {
    return jsonError(err);
  }
}
