import { stepsLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, stepsLogInput);
    const supabase = await createSupabaseServerClient();
    // steps_logs has UNIQUE(user_id, day) → upsert.
    const { error, data: row } = await supabase
      .from("steps_logs")
      .upsert(
        {
          user_id: user.id,
          day: data.day.toISOString().slice(0, 10),
          count: data.count,
          source: data.source,
        },
        { onConflict: "user_id,day" },
      )
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
