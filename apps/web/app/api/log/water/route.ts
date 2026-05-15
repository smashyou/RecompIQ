import { waterLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, waterLogInput);
    const loggedAt = data.logged_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { error, data: row } = await supabase
      .from("water_logs")
      .insert({
        user_id: user.id,
        logged_at: loggedAt.toISOString(),
        volume_oz: data.volume_oz,
      })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
