import { stackInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { addPhaseFromStackInput } from "@/lib/regimen-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cutover (Regimen redesign §4.1): the legacy "stacks" surface now reads/writes
// the single living regimen. A "stack" maps to a regimen PHASE; items map to
// regimen_items. Legacy peptide_stacks tables are frozen (read-only) for rollback.

export async function GET() {
  try {
    const user = await requireUser();
    const regimen = await loadActiveRegimen(user.id);
    // Shape phases as legacy "stacks" for any backward-compatible consumer.
    const stacks = (regimen?.phases ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      phase: p.legacy_phase,
      started_on: p.starts_on,
      ended_on: p.ends_on,
      is_active: p.ends_on === null,
      peptide_stack_items: p.items.map((i) => ({
        id: i.id,
        dose_value: i.dose_value,
        dose_unit: i.dose_unit,
        route: i.route,
        frequency: i.frequency,
        notes: i.notes,
        compounds: i.compound
          ? {
              slug: i.compound.slug,
              name: i.compound.name,
              evidence_level: i.compound.evidence_level,
              fda_approved: i.compound.fda_approved,
            }
          : null,
      })),
    }));
    return jsonOk(stacks);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, stackInput);
    const supabase = await createSupabaseServerClient();
    const phaseId = await addPhaseFromStackInput(supabase, user.id, data);
    // Keep the `stack_id` key for the existing client; it is now a phase id.
    return jsonOk({ stack_id: phaseId });
  } catch (err) {
    return jsonError(err);
  }
}
