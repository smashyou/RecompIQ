import { regimenPhaseAdvanceInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { advanceRegimenPhase } from "@/lib/regimen-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Advance the regimen: close the current open phase(s) and open a new one.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, regimenPhaseAdvanceInput);
    const supabase = await createSupabaseServerClient();
    const phaseId = await advanceRegimenPhase(supabase, user.id, data);
    return jsonOk({ phase_id: phaseId });
  } catch (err) {
    return jsonError(err);
  }
}
