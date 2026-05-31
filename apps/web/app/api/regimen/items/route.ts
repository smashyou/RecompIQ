import { regimenItemAddInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { addRegimenItem } from "@/lib/regimen-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add one compound to the active regimen's current phase (inline drawer save).
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, regimenItemAddInput);
    const supabase = await createSupabaseServerClient();
    const itemId = await addRegimenItem(supabase, user.id, data);
    return jsonOk({ item_id: itemId });
  } catch (err) {
    return jsonError(err);
  }
}
