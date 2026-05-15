import { sleepLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, sleepLogInput);
    const supabase = await createSupabaseServerClient();
    // sleep_logs has UNIQUE(user_id, night_of) → upsert.
    const { error, data: row } = await supabase
      .from("sleep_logs")
      .upsert(
        {
          user_id: user.id,
          night_of: data.night_of.toISOString().slice(0, 10),
          duration_min: data.duration_min,
          quality: data.quality ?? null,
          note: data.note ?? null,
        },
        { onConflict: "user_id,night_of" },
      )
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
