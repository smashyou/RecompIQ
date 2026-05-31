import { regimenItemStopInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { stopRegimenItem } from "@/lib/regimen-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stop (end) an item in the regimen.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = await parseJson(req, regimenItemStopInput);
    const supabase = await createSupabaseServerClient();
    await stopRegimenItem(supabase, user.id, id, data);
    return jsonOk({ item_id: id });
  } catch (err) {
    return jsonError(err);
  }
}
