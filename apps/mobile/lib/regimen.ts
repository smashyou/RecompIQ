import { supabase } from "@/lib/supabase";

// Mobile mirror of the web regimen model (REGIMEN_GOALS_PRD §4.1/§5.3).
// Reads + writes go through supabase-js directly (RLS-scoped). DOSE VALUES ARE
// USER/CLINICIAN-SUPPLIED — nullable = undecided, never fabricated.

export interface RegimenCompound {
  slug: string;
  name: string;
  short_description: string | null;
  evidence_level: string;
  fda_approved: boolean;
  absolute_contraindications: string[];
  relative_contraindications: string[];
}

export interface RegimenItem {
  id: string;
  phase_id: string;
  compound_id: string;
  dose_value: number | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  compound: RegimenCompound | null;
}

export interface RegimenPhase {
  id: string;
  ordinal: number;
  name: string;
  legacy_phase: string | null;
  starts_on: string | null;
  ends_on: string | null;
  items: RegimenItem[];
}

export interface ActiveRegimen {
  id: string;
  title: string;
  phases: RegimenPhase[];
  currentItems: RegimenItem[];
  currentPhase: RegimenPhase | null;
}

const SELECT =
  "id,title,is_active, regimen_phases(id,ordinal,name,legacy_phase,starts_on,ends_on,notes, regimen_items(id,phase_id,compound_id,dose_value,dose_unit,route,frequency,starts_on,ends_on,notes, compounds(slug,name,short_description,evidence_level,fda_approved,absolute_contraindications,relative_contraindications)))";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function loadActiveRegimen(userId: string): Promise<ActiveRegimen | null> {
  const { data } = await supabase
    .from("regimens")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const raw = data as any;
  const phases: RegimenPhase[] = (raw.regimen_phases ?? [])
    .map((p: any) => ({
      id: p.id,
      ordinal: p.ordinal,
      name: p.name,
      legacy_phase: p.legacy_phase ?? null,
      starts_on: p.starts_on ?? null,
      ends_on: p.ends_on ?? null,
      items: (p.regimen_items ?? [])
        .map((i: any) => {
          const c = one<any>(i.compounds);
          return {
            id: i.id,
            phase_id: i.phase_id,
            compound_id: i.compound_id,
            dose_value: i.dose_value !== null && i.dose_value !== undefined ? Number(i.dose_value) : null,
            dose_unit: i.dose_unit ?? null,
            route: i.route ?? null,
            frequency: i.frequency ?? null,
            starts_on: i.starts_on ?? null,
            ends_on: i.ends_on ?? null,
            notes: i.notes ?? null,
            compound: c
              ? {
                  slug: c.slug,
                  name: c.name,
                  short_description: c.short_description ?? null,
                  evidence_level: c.evidence_level ?? "ANECDOTAL",
                  fda_approved: Boolean(c.fda_approved),
                  absolute_contraindications: c.absolute_contraindications ?? [],
                  relative_contraindications: c.relative_contraindications ?? [],
                }
              : null,
          } as RegimenItem;
        })
        .filter((i: RegimenItem) => i.compound !== null),
    }))
    .sort((a: RegimenPhase, b: RegimenPhase) => a.ordinal - b.ordinal);

  const open = phases.filter((p) => p.ends_on === null);
  const currentItems = open.flatMap((p) => p.items.filter((i) => i.ends_on === null));
  const currentPhase = open.length > 0 ? open[open.length - 1] : (phases[phases.length - 1] ?? null);

  return { id: raw.id, title: raw.title, phases, currentItems, currentPhase };
}

// ---------------------------------------------------------------
// Writers (RLS-scoped; user_id required on insert).
// ---------------------------------------------------------------

const isoToday = () => new Date().toISOString().slice(0, 10);

async function ensureActiveRegimen(userId: string): Promise<string> {
  const { data } = await supabase
    .from("regimens")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await supabase
    .from("regimens")
    .insert({ user_id: userId, title: "My Regimen", is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

async function ensureCurrentPhase(userId: string, regimenId: string): Promise<string> {
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
      ordinal: ((maxRow?.ordinal as number) ?? 0) + 1,
      name: "Phase 1",
      starts_on: isoToday(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return phase.id as string;
}

export interface AddItemInput {
  compound_id: string;
  dose_value: number | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  starts_on: string | null;
  notes: string | null;
  reconstitution?: {
    vial_mg: number;
    bac_water_ml: number;
    concentration_mg_per_ml: number;
    desired_dose_mg: number | null;
    syringe_units_per_ml: number;
    draw_ml: number;
    insulin_units: number | null;
  } | null;
  log_first_dose?: boolean;
  injection_site?: string | null;
}

async function persistRecon(
  userId: string,
  compoundId: string,
  recon: AddItemInput["reconstitution"],
): Promise<string | null> {
  if (!recon) return null;
  const { data, error } = await supabase
    .from("reconstitution_records")
    .insert({
      user_id: userId,
      compound_id: compoundId,
      vial_mg: recon.vial_mg,
      bac_water_ml: recon.bac_water_ml,
      concentration_mg_per_ml: recon.concentration_mg_per_ml,
      desired_dose_mg: recon.desired_dose_mg,
      syringe_units_per_ml: recon.syringe_units_per_ml,
      draw_ml: recon.draw_ml,
      insulin_units: recon.insulin_units,
      reconstituted_on: isoToday(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function addRegimenItem(userId: string, input: AddItemInput): Promise<string> {
  const regimenId = await ensureActiveRegimen(userId);
  const phaseId = await ensureCurrentPhase(userId, regimenId);
  const reconId = await persistRecon(userId, input.compound_id, input.reconstitution);

  const { data: item, error } = await supabase
    .from("regimen_items")
    .insert({
      regimen_id: regimenId,
      phase_id: phaseId,
      user_id: userId,
      compound_id: input.compound_id,
      dose_value: input.dose_value,
      dose_unit: input.dose_unit,
      route: input.route,
      frequency: input.frequency,
      source: "user",
      starts_on: input.starts_on,
      notes: input.notes,
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
    effective_on: input.starts_on ?? isoToday(),
  });

  if (input.log_first_dose && input.dose_value && input.dose_unit && input.route) {
    await supabase.from("peptide_doses").insert({
      user_id: userId,
      regimen_item_id: itemId,
      compound_id: input.compound_id,
      taken_at: new Date().toISOString(),
      dose_value: input.dose_value,
      dose_unit: input.dose_unit,
      route: input.route,
      injection_site: input.injection_site ?? null,
      adherence: "taken",
    });
  }
  return itemId;
}

export interface PatchItemInput {
  dose_value?: number | null;
  dose_unit?: string | null;
  route?: string | null;
  frequency?: string | null;
  starts_on?: string | null;
  notes?: string | null;
  reconstitution?: AddItemInput["reconstitution"];
}

export async function patchRegimenItem(userId: string, itemId: string, input: PatchItemInput): Promise<void> {
  const { data: before, error: readErr } = await supabase
    .from("regimen_items")
    .select("regimen_id,compound_id,dose_value,dose_unit,route,frequency")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();
  if (readErr || !before) throw readErr ?? new Error("Item not found");

  const patch: Record<string, unknown> = {};
  if (input.dose_value !== undefined) patch.dose_value = input.dose_value;
  if (input.dose_unit !== undefined) patch.dose_unit = input.dose_unit;
  if (input.route !== undefined) patch.route = input.route;
  if (input.frequency !== undefined) patch.frequency = input.frequency;
  if (input.starts_on !== undefined) patch.starts_on = input.starts_on;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.reconstitution) {
    patch.reconstitution_record_id = await persistRecon(
      userId,
      before.compound_id as string,
      input.reconstitution,
    );
  }

  const { error: updErr } = await supabase
    .from("regimen_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updErr) throw updErr;

  const doseChanged =
    (input.dose_value !== undefined && input.dose_value !== Number(before.dose_value)) ||
    (input.dose_unit !== undefined && input.dose_unit !== before.dose_unit);

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
    effective_on: isoToday(),
  });
}

export async function stopRegimenItem(userId: string, itemId: string): Promise<void> {
  const { data: before, error: readErr } = await supabase
    .from("regimen_items")
    .select("regimen_id,compound_id,dose_value,dose_unit,route,frequency")
    .eq("id", itemId)
    .eq("user_id", userId)
    .single();
  if (readErr || !before) throw readErr ?? new Error("Item not found");
  const endsOn = isoToday();
  const { error: updErr } = await supabase
    .from("regimen_items")
    .update({ ends_on: endsOn })
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

export async function advanceRegimenPhase(userId: string, name: string): Promise<string> {
  const regimenId = await ensureActiveRegimen(userId);
  const startsOn = isoToday();
  await supabase
    .from("regimen_phases")
    .update({ ends_on: startsOn })
    .eq("regimen_id", regimenId)
    .is("ends_on", null);
  const { data: maxRow } = await supabase
    .from("regimen_phases")
    .select("ordinal")
    .eq("regimen_id", regimenId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordinal = ((maxRow?.ordinal as number) ?? 0) + 1;
  const { data: phase, error } = await supabase
    .from("regimen_phases")
    .insert({ regimen_id: regimenId, user_id: userId, ordinal, name, starts_on: startsOn })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("regimen_changes").insert({
    regimen_id: regimenId,
    user_id: userId,
    kind: "phase_advance",
    after: { phase_id: phase.id, name, ordinal },
    effective_on: startsOn,
  });
  return phase.id as string;
}
