import { conditionsStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { items } = await parseJson(req, conditionsStepSchema);
    const supabase = await createSupabaseServerClient();

    await supabase.from("conditions").delete().eq("user_id", user.id);

    if (items.length === 0) return jsonOk({ inserted: 0 });

    const payload = items.map((c) => ({
      user_id: user.id,
      name: c.name,
      detail: c.detail ?? null,
      diagnosed_at: c.diagnosed_at ? c.diagnosed_at.toISOString().slice(0, 10) : null,
      active: c.active,
    }));

    const { error, data } = await supabase.from("conditions").insert(payload).select();
    if (error) throw error;
    return jsonOk({ inserted: data?.length ?? 0 });
  } catch (err) {
    return jsonError(err);
  }
}
