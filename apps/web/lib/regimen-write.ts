import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StackInput } from "@peptide/shared";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Only the fields we use — avoids the is_active input/output variance from the
// schema's .default(true), so the validated payload assigns cleanly.
type StackPhasePayload = Pick<StackInput, "name" | "phase" | "started_on" | "notes" | "items">;

/** Return the user's active regimen id, creating one if none exists. */
export async function ensureActiveRegimen(
  supabase: ServerClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("regimens")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("regimens")
    .insert({ user_id: userId, title: "My Regimen", is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

function toDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * Add a phase (with its items) to the user's active regimen from a legacy
 * StackInput payload. Each item is appended and recorded in the change log.
 * Interim bridge: the legacy "New stack" form posts here until the Phase-2
 * inline add/edit drawer replaces it. Returns the new phase id.
 */
export async function addPhaseFromStackInput(
  supabase: ServerClient,
  userId: string,
  data: StackPhasePayload,
): Promise<string> {
  const regimenId = await ensureActiveRegimen(supabase, userId);

  const { data: maxRow } = await supabase
    .from("regimen_phases")
    .select("ordinal")
    .eq("regimen_id", regimenId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrdinal = (maxRow?.ordinal ?? 0) + 1;
  const startsOn = toDate(data.started_on);

  const { data: phase, error: phaseErr } = await supabase
    .from("regimen_phases")
    .insert({
      regimen_id: regimenId,
      user_id: userId,
      ordinal: nextOrdinal,
      name: data.name,
      legacy_phase: data.phase ?? null,
      starts_on: startsOn,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();
  if (phaseErr) throw phaseErr;
  const phaseId = phase.id as string;

  const itemRows = data.items.map((i) => ({
    regimen_id: regimenId,
    phase_id: phaseId,
    user_id: userId,
    compound_id: i.compound_id,
    dose_value: i.dose_value,
    dose_unit: i.dose_unit,
    route: i.route,
    frequency: i.frequency,
    source: "user" as const,
    starts_on: startsOn,
    notes: i.notes ?? null,
  }));
  const { data: inserted, error: itemsErr } = await supabase
    .from("regimen_items")
    .insert(itemRows)
    .select("id,compound_id,dose_value,dose_unit,route,frequency");
  if (itemsErr) throw itemsErr;

  // Append-only change-log spine.
  const changeRows = (inserted ?? []).map((it) => ({
    regimen_id: regimenId,
    item_id: it.id,
    user_id: userId,
    kind: "add" as const,
    after: {
      compound_id: it.compound_id,
      dose_value: it.dose_value,
      dose_unit: it.dose_unit,
      route: it.route,
      frequency: it.frequency,
    },
    effective_on: startsOn ?? new Date().toISOString().slice(0, 10),
  }));
  if (changeRows.length > 0) {
    await supabase.from("regimen_changes").insert(changeRows);
  }

  return phaseId;
}
