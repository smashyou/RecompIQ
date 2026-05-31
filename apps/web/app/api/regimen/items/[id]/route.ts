import { regimenItemPatchInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { patchRegimenItem } from "@/lib/regimen-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit an existing regimen item (dose / route / frequency / mix).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = await parseJson(req, regimenItemPatchInput);
    const supabase = await createSupabaseServerClient();
    await patchRegimenItem(supabase, user.id, id, data);
    return jsonOk({ item_id: id });
  } catch (err) {
    return jsonError(err);
  }
}
