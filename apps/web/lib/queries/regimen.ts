import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Shared read layer for the goal-driven Regimen model (REGIMEN_GOALS_PRD §4.1).
// One living regimen per user, phased over time. Replaces the legacy
// peptide_stacks reads. DOSE VALUES ARE USER/CLINICIAN-SUPPLIED — never
// fabricated; nullable when undecided.

export interface RegimenCompoundView {
  slug: string;
  name: string;
  short_description: string | null;
  evidence_level: string;
  fda_approved: boolean;
  absolute_contraindications: string[];
  relative_contraindications: string[];
}

export interface RegimenItemView {
  id: string;
  phase_id: string;
  compound_id: string;
  dose_value: number | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  source: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  compound: RegimenCompoundView | null;
}

export interface RegimenPhaseView {
  id: string;
  ordinal: number;
  name: string;
  legacy_phase: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  items: RegimenItemView[];
}

export interface ActiveRegimenView {
  id: string;
  title: string;
  is_active: boolean;
  phases: RegimenPhaseView[];
  /** Items the user is on right now: phase not ended AND item not ended. */
  currentItems: RegimenItemView[];
  /** Tip phase (highest ordinal still open) — used only for a label. */
  currentPhase: RegimenPhaseView | null;
}

interface RawCompound {
  slug?: string | null;
  name?: string | null;
  short_description?: string | null;
  evidence_level?: string | null;
  fda_approved?: boolean | null;
  absolute_contraindications?: string[] | null;
  relative_contraindications?: string[] | null;
}

interface RawItem {
  id: string;
  phase_id: string;
  compound_id: string;
  dose_value: number | string | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  source: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  // Supabase types a to-one join as an array.
  compounds?: RawCompound | RawCompound[] | null;
}

interface RawPhase {
  id: string;
  ordinal: number;
  name: string;
  legacy_phase: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  regimen_items?: RawItem[] | null;
}

interface RawRegimen {
  id: string;
  title: string;
  is_active: boolean;
  regimen_phases?: RawPhase[] | null;
}

function mapCompound(raw: RawCompound | RawCompound[] | null | undefined): RegimenCompoundView | null {
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c?.slug || !c?.name) return null;
  return {
    slug: c.slug,
    name: c.name,
    short_description: c.short_description ?? null,
    evidence_level: c.evidence_level ?? "ANECDOTAL",
    fda_approved: Boolean(c.fda_approved),
    absolute_contraindications: c.absolute_contraindications ?? [],
    relative_contraindications: c.relative_contraindications ?? [],
  };
}

function mapItem(raw: RawItem): RegimenItemView {
  return {
    id: raw.id,
    phase_id: raw.phase_id,
    compound_id: raw.compound_id,
    dose_value: raw.dose_value !== null && raw.dose_value !== undefined ? Number(raw.dose_value) : null,
    dose_unit: raw.dose_unit ?? null,
    route: raw.route ?? null,
    frequency: raw.frequency ?? null,
    source: raw.source ?? "user",
    starts_on: raw.starts_on ?? null,
    ends_on: raw.ends_on ?? null,
    notes: raw.notes ?? null,
    compound: mapCompound(raw.compounds),
  };
}

export const regimenSelectFields =
  "id,title,is_active, regimen_phases(id,ordinal,name,legacy_phase,starts_on,ends_on,notes, regimen_items(id,phase_id,compound_id,dose_value,dose_unit,route,frequency,source,starts_on,ends_on,notes, compounds(slug,name,short_description,evidence_level,fda_approved,absolute_contraindications,relative_contraindications)))";

/**
 * Load the user's single active regimen with phases + items + compounds.
 * Returns null when the user has no regimen yet.
 */
export async function loadActiveRegimen(userId: string): Promise<ActiveRegimenView | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("regimens")
    .select(regimenSelectFields)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return shapeRegimen(data as RawRegimen | null);
}

export function shapeRegimen(raw: RawRegimen | null): ActiveRegimenView | null {
  if (!raw) return null;

  const phases: RegimenPhaseView[] = (raw.regimen_phases ?? [])
    .map((p) => ({
      id: p.id,
      ordinal: p.ordinal,
      name: p.name,
      legacy_phase: p.legacy_phase ?? null,
      starts_on: p.starts_on ?? null,
      ends_on: p.ends_on ?? null,
      notes: p.notes ?? null,
      items: (p.regimen_items ?? [])
        .map(mapItem)
        // stable order: keep dosed/active first by created order — Supabase returns insert order
        .filter((i) => i.compound !== null),
    }))
    .sort((a, b) => a.ordinal - b.ordinal);

  const openPhases = phases.filter((p) => p.ends_on === null);
  const currentItems = openPhases.flatMap((p) => p.items.filter((i) => i.ends_on === null));
  const currentPhase =
    openPhases.length > 0 ? openPhases[openPhases.length - 1]! : (phases[phases.length - 1] ?? null);

  return {
    id: raw.id,
    title: raw.title,
    is_active: raw.is_active,
    phases,
    currentItems,
    currentPhase,
  };
}

/**
 * Slugs of compounds the user is actively taking now (current regimen items).
 * Replaces the legacy peptide_stack_items read used by the coach RAG context.
 */
export async function userActiveCompoundSlugs(userId: string): Promise<string[]> {
  const regimen = await loadActiveRegimen(userId);
  if (!regimen) return [];
  return Array.from(
    new Set(regimen.currentItems.map((i) => i.compound?.slug).filter((s): s is string => Boolean(s))),
  );
}
