import { medicationsStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { items } = await parseJson(req, medicationsStepSchema);
    const supabase = await createSupabaseServerClient();

    await supabase.from("medications").delete().eq("user_id", user.id);

    if (items.length === 0) return jsonOk({ inserted: 0 });

    const payload = items.map((m) => ({
      user_id: user.id,
      name: m.name,
      dose: m.dose ?? null,
      route: m.route ?? null,
      started_at: m.started_at ? m.started_at.toISOString().slice(0, 10) : null,
      active: m.active,
    }));

    const { error, data } = await supabase.from("medications").insert(payload).select();
    if (error) throw error;
    return jsonOk({ inserted: data?.length ?? 0 });
  } catch (err) {
    return jsonError(err);
  }
}
