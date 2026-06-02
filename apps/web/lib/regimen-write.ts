import "server-only";
import {
  AppError,
  regimenItemAddInput,
  regimenItemPatchInput,
  regimenItemStopInput,
  regimenPhaseAdvanceInput,
} from "@peptide/shared";
import type { z } from "zod";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Accept the schema INPUT types (defaults optional) — matches what parseJson
// returns; zod has already applied the runtime defaults before we get here.
type RegimenItemAddInput = z.input<typeof regimenItemAddInput>;
type RegimenItemPatchInput = z.input<typeof regimenItemPatchInput>;
type RegimenItemStopInput = z.input<typeof regimenItemStopInput>;
type RegimenPhaseAdvanceInput = z.input<typeof regimenPhaseAdvanceInput>;

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

// ---------------------------------------------------------------
// Granular item / phase operations (Phase 2 inline add/edit drawer).
// All write the regimen_changes append-only spine with before/after.
// ---------------------------------------------------------------

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Current phase = highest-ordinal still-open phase; created if the regimen has none. */
export async function ensureCurrentPhase(
  supabase: ServerClient,
  userId: string,
  regimenId: string,
): Promise<string> {
  const { data: open } = await supabase
    .from("regimen_phases")
    .select("id,ordinal")
    .eq("regimen_id", regimenId)
    .is("ends_on", null)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open?.id) return open.id as string;

  const { data: maxRow } = await supabase
    .from("regimen_phases")
    .select("ordinal")
    .eq("regimen_id", regimenId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: phase, error } = await supabase
    .from("regimen_phases")
    .insert({
      regimen_id: regimenId,
      user_id: userId,
      ordinal: (maxRow?.ordinal ?? 0) + 1,
      name: "Phase 1",
      starts_on: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw error;
  return phase.id as string;
}

// Persist a reconstitution mix (verifying ownership is enforced by the DB
// trigger added in 20260531140000) and return its id, or null when no mix given.
async function persistReconstitution(
  supabase: ServerClient,
  userId: string,
  compoundId: string,
  recon: RegimenItemAddInput["reconstitution"],
): Promise<string | null> {
  if (!recon) return null;
  const { data, error } = await supabase
    .from("reconstitution_records")
    .insert({
      user_id: userId,
      compound_id: recon.compound_id ?? compoundId,
      label: recon.label ?? null,
      vial_mg: recon.vial_mg,
      bac_water_ml: recon.bac_water_ml,
      concentration_mg_per_ml: recon.concentration_mg_per_ml,
      desired_dose_mg: recon.desired_dose_mg ?? null,
      syringe_units_per_ml: recon.syringe_units_per_ml ?? null,
      draw_ml: recon.draw_ml ?? null,
      insulin_units: recon.insulin_units ?? null,
      vial_cost_usd: recon.vial_cost_usd ?? null,
      reconstituted_on: (recon.reconstituted_on ?? new Date()).toISOString().slice(0, 10),
      notes: recon.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Add a single item to the active regimen's current phase. Returns the item id. */
export async function addRegimenItem(
  supabase: ServerClient,
  userId: string,
  data: RegimenItemAddInput,
): Promise<string> {
  const regimenId = await ensureActiveRegimen(supabase, userId);
  const phaseId = data.phase_id ?? (await ensureCurrentPhase(supabase, userId, regimenId));
  const startsOn = isoDate(data.starts_on);
  const reconId = await persistReconstitution(supabase, userId, data.compound_id, data.reconstitution);

  const { data: item, error } = await supabase
    .from("regimen_items")
    .insert({
      regimen_id: regimenId,
      phase_id: phaseId,
      user_id: userId,
      compound_id: data.compound_id,
      dose_value: data.dose_value ?? null,
      dose_unit: data.dose_unit ?? null,
      route: data.route ?? null,
      frequency: data.frequency ?? null,
      source: data.source,
      starts_on: startsOn,
      notes: data.notes ?? null,
      reconstitution_record_id: reconId,
    })
    .select("id,compound_id,dose_value,dose_unit,route,frequency")
    .single();
  if (error) throw error;
  const itemId = item.id as string;

  await supabase.from("regimen_changes").insert({
    regimen_id: regimenId,
    item_id: itemId,
    user_id: userId,
    kind: "add",
    after: {
      compound_id: item.compound_id,
      dose_value: item.dose_value,
      dose_unit: item.dose_unit,
      route: item.route,
      frequency: item.frequency,
    },
    effective_on: startsOn ?? new Date().toISOString().slice(0, 10),
  });

  // "Add & log first dose" save fork.
  if (data.log_first_dose && data.dose_value && data.dose_unit && data.route) {
    await supabase.from("peptide_doses").insert({
      user_id: userId,
      regimen_item_id: itemId,
      compound_id: data.compound_id,
      taken_at: new Date().toISOString(),
      dose_value: data.dose_value,
      dose_unit: data.dose_unit,
      route: data.route,
      injection_site: data.injection_site ?? null,
      adherence: "taken",
    });
  }

  return itemId;
}

/** Edit an existing item; records a dose_change/edit with before+after. */
export async function patchRegimenItem(
  supabase: ServerClient,
  userId: string,
  itemId: string,
  data: RegimenItemPatchInput,
): Promise<void> {
  const { data: before, error: readErr } = await supabase
    .from("regimen_items")
    .select("regimen_id,compound_id,dose_value,dose_unit,route,frequency,starts_on,notes,reconstitution_record_id")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();
  if (readErr || !before) throw new AppError("NOT_FOUND", "Regimen item not found");

  const patch: Record<string, unknown> = {};
  if (data.dose_value !== undefined) patch.dose_value = data.dose_value;
  if (data.dose_unit !== undefined) patch.dose_unit = data.dose_unit;
  if (data.route !== undefined) patch.route = data.route;
  if (data.frequency !== undefined) patch.frequency = data.frequency;
  if (data.starts_on !== undefined) patch.starts_on = isoDate(data.starts_on);
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.reconstitution) {
    patch.reconstitution_record_id = await persistReconstitution(
      supabase,
      userId,
      before.compound_id as string,
      data.reconstitution,
    );
  }

  const { error: updErr } = await supabase
    .from("regimen_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updErr) throw updErr;

  const doseChanged =
    (data.dose_value !== undefined && data.dose_value !== Number(before.dose_value)) ||
    (data.dose_unit !== undefined && data.dose_unit !== before.dose_unit);

  await supabase.from("regimen_changes").insert({
    regimen_id: before.regimen_id,
    item_id: itemId,
    user_id: userId,
    kind: doseChanged ? "dose_change" : "edit",
    before: {
      dose_value: before.dose_value,
      dose_unit: before.dose_unit,
      route: before.route,
      frequency: before.frequency,
    },
    after: {
      dose_value: patch.dose_value ?? before.dose_value,
      dose_unit: patch.dose_unit ?? before.dose_unit,
      route: patch.route ?? before.route,
      frequency: patch.frequency ?? before.frequency,
    },
    effective_on: new Date().toISOString().slice(0, 10),
  });
}

/** Stop (end) an item; records a 'stop' change with the prior state. */
export async function stopRegimenItem(
  supabase: ServerClient,
  userId: string,
  itemId: string,
  data: RegimenItemStopInput,
): Promise<void> {
  const { data: before, error: readErr } = await supabase
    .from("regimen_items")
    .select("regimen_id,compound_id,dose_value,dose_unit,route,frequency")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();
  if (readErr || !before) throw new AppError("NOT_FOUND", "Regimen item not found");

  const endsOn = isoDate(data.ends_on) ?? new Date().toISOString().slice(0, 10);
  const { error: updErr } = await supabase
    .from("regimen_items")
    .update({ ends_on: endsOn, notes: data.notes ?? undefined })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updErr) throw updErr;

  await supabase.from("regimen_changes").insert({
    regimen_id: before.regimen_id,
    item_id: itemId,
    user_id: userId,
    kind: "stop",
    before: {
      compound_id: before.compound_id,
      dose_value: before.dose_value,
      dose_unit: before.dose_unit,
      route: before.route,
      frequency: before.frequency,
    },
    effective_on: endsOn,
  });
}

/** Advance to a new phase: close current open phase(s) and open a new one. */
export async function advanceRegimenPhase(
  supabase: ServerClient,
  userId: string,
  data: RegimenPhaseAdvanceInput,
): Promise<string> {
  const regimenId = await ensureActiveRegimen(supabase, userId);
  const startsOn = isoDate(data.starts_on) ?? new Date().toISOString().slice(0, 10);

  if (data.close_current) {
    await supabase
      .from("regimen_phases")
      .update({ ends_on: startsOn })
      .eq("regimen_id", regimenId)
      .is("ends_on", null);
  }

  const { data: maxRow } = await supabase
    .from("regimen_phases")
    .select("ordinal")
    .eq("regimen_id", regimenId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: phase, error } = await supabase
    .from("regimen_phases")
    .insert({
      regimen_id: regimenId,
      user_id: userId,
      ordinal: (maxRow?.ordinal ?? 0) + 1,
      name: data.name,
      legacy_phase: data.legacy_phase ?? null,
      starts_on: startsOn,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("regimen_changes").insert({
    regimen_id: regimenId,
    user_id: userId,
    kind: "phase_advance",
    after: { phase_id: phase.id, name: data.name, ordinal: (maxRow?.ordinal ?? 0) + 1 },
    effective_on: startsOn,
  });

  return phase.id as string;
}
