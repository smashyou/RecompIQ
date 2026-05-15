import { injuriesStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { items } = await parseJson(req, injuriesStepSchema);
    const supabase = await createSupabaseServerClient();

    await supabase.from("injuries").delete().eq("user_id", user.id);

    if (items.length === 0) return jsonOk({ inserted: 0 });

    const payload = items.map((i) => ({
      user_id: user.id,
      name: i.name,
      detail: i.detail ?? null,
      occurred_at: i.occurred_at ? i.occurred_at.toISOString().slice(0, 10) : null,
      active: i.active,
    }));

    const { error, data } = await supabase.from("injuries").insert(payload).select();
    if (error) throw error;
    return jsonOk({ inserted: data?.length ?? 0 });
  } catch (err) {
    return jsonError(err);
  }
}
