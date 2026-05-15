import { weightLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, weightLogInput);
    const valueLb = data.unit === "kg" ? data.value * 2.20462 : data.value;
    const loggedAt = data.logged_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { error, data: row } = await supabase
      .from("weights")
      .insert({
        user_id: user.id,
        value_lb: valueLb,
        logged_at: loggedAt.toISOString(),
        note: data.note ?? null,
        source: data.source,
      })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
