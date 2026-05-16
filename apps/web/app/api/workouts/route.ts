import { workoutInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("workouts")
      .select("id,session_type,phase,date,duration_min,template_slug,name,perceived_exertion,notes,created_at, workout_exercises(id,order_index,name,sets,reps,load_lb,duration_min,rpe,notes)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, workoutInput);
    const date = data.date ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        session_type: data.session_type,
        phase: data.phase ?? null,
        date: date.toISOString().slice(0, 10),
        duration_min: data.duration_min ?? null,
        perceived_exertion: data.perceived_exertion ?? null,
        template_slug: data.template_slug ?? null,
        name: data.name ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
