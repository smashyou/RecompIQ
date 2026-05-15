import { goalStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, goalStepSchema);
    const supabase = await createSupabaseServerClient();

    const existing = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const payload = {
      user_id: user.id,
      start_weight_lb: data.start_weight_lb,
      goal_weight_lb_min: data.goal_weight_lb_min,
      goal_weight_lb_max: data.goal_weight_lb_max,
      timeline_weeks: data.timeline_weeks,
      phase: data.phase,
      protein_target_g_min: data.protein_target_g_min,
      protein_target_g_max: data.protein_target_g_max,
    };

    const { error, data: row } = existing.data
      ? await supabase.from("goals").update(payload).eq("id", existing.data.id).select().single()
      : await supabase.from("goals").insert(payload).select().single();

    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
