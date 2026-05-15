import { symptomLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, symptomLogInput);
    const loggedAt = data.logged_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { error, data: row } = await supabase
      .from("symptoms")
      .insert({
        user_id: user.id,
        logged_at: loggedAt.toISOString(),
        mood: data.mood ?? null,
        energy: data.energy ?? null,
        pain: data.pain ?? null,
        appetite: data.appetite ?? null,
        nausea: data.nausea ?? null,
        reflux: data.reflux ?? null,
        constipation: data.constipation ?? null,
        neuro_note: data.neuro_note ?? null,
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
