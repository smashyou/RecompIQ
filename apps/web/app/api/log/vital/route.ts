import { vitalLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, vitalLogInput);
    const loggedAt = data.logged_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { error, data: row } = await supabase
      .from("vitals")
      .insert({
        user_id: user.id,
        logged_at: loggedAt.toISOString(),
        bp_systolic: data.bp_systolic ?? null,
        bp_diastolic: data.bp_diastolic ?? null,
        hr: data.hr ?? null,
        glucose_mgdl: data.glucose_mgdl ?? null,
        ketones_mmol: data.ketones_mmol ?? null,
        temp_f: data.temp_f ?? null,
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
