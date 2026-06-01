import { userGoalsReplaceInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the user's goals (priority order).
export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true });
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

// Replace the user's whole goal set (the multi-select picker save).
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { goals } = await parseJson(req, userGoalsReplaceInput);
    const supabase = await createSupabaseServerClient();
    const keys = goals.map((g) => g.goal_key);

    // Delete goals the user no longer has (trigger strips them from phase goal_ids).
    const { data: existing } = await supabase
      .from("user_goals")
      .select("id,goal_key")
      .eq("user_id", user.id);
    const removed = (existing ?? []).filter((r) => !keys.includes(r.goal_key as never));
    if (removed.length > 0) {
      await supabase
        .from("user_goals")
        .delete()
        .in(
          "id",
          removed.map((r) => r.id),
        );
    }

    if (goals.length > 0) {
      const rows = goals.map((g, i) => ({
        user_id: user.id,
        goal_key: g.goal_key,
        priority: g.priority ?? i + 1,
        status: g.status ?? "active",
        target: g.target ?? {},
        notes: g.notes ?? null,
      }));
      const { error } = await supabase
        .from("user_goals")
        .upsert(rows, { onConflict: "user_id,goal_key" });
      if (error) throw error;
    }

    return jsonOk({ count: goals.length });
  } catch (err) {
    return jsonError(err);
  }
}
