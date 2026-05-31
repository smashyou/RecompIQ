import { z } from "zod";
import { ADHERENCE, EVIDENCE_LEVEL, GOAL_PHASE, ROUTE } from "../../enums/index";

export const DOSE_UNIT = ["mg", "mcg", "iu", "ml", "units"] as const;
export type DoseUnit = (typeof DOSE_UNIT)[number];

// Stack item — a compound + dose schedule. DOSE IS USER/CLINICIAN-SUPPLIED.
export const stackItemInput = z.object({
  compound_id: z.string().uuid(),
  dose_value: z.number().positive().max(100000),
  dose_unit: z.enum(DOSE_UNIT),
  route: z.enum(ROUTE),
  frequency: z.string().trim().min(1).max(80),
  notes: z.string().max(500).nullable().optional(),
});
export type StackItemInput = z.infer<typeof stackItemInput>;

export const stackInput = z.object({
  name: z.string().trim().min(1).max(120),
  phase: z.enum(GOAL_PHASE).nullable().optional(),
  started_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().default(true),
  items: z.array(stackItemInput).min(1).max(20),
});
export type StackInput = z.infer<typeof stackInput>;

// ---------------------------------------------------------------
// Regimen model (goal-driven redesign — REGIMEN_GOALS_PRD §4.1).
// One living regimen per user, phased over time. Replaces the multi-"stack"
// model. DOSE VALUES ARE USER/CLINICIAN-SUPPLIED — the app does NOT prescribe;
// dose fields are nullable (null = undecided, never a fabricated number).
// ---------------------------------------------------------------
export const REGIMEN_ITEM_SOURCE = ["user", "clinician", "ai_suggested"] as const;
export type RegimenItemSource = (typeof REGIMEN_ITEM_SOURCE)[number];

export const REGIMEN_CHANGE_KIND = [
  "add",
  "edit",
  "stop",
  "dose_change",
  "phase_advance",
  "phase_add",
] as const;
export type RegimenChangeKind = (typeof REGIMEN_CHANGE_KIND)[number];

export const regimenInput = z.object({
  title: z.string().trim().min(1).max(120).default("My Regimen"),
  is_active: z.boolean().default(true),
});
export type RegimenInput = z.infer<typeof regimenInput>;

export const regimenPhaseInput = z.object({
  ordinal: z.number().int().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120),
  legacy_phase: z.enum(GOAL_PHASE).nullable().optional(),
  goal_ids: z.array(z.string().uuid()).max(20).default([]),
  starts_on: z.coerce.date().nullable().optional(),
  ends_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type RegimenPhaseInput = z.infer<typeof regimenPhaseInput>;

export const regimenItemInput = z.object({
  phase_id: z.string().uuid().nullable().optional(),
  compound_id: z.string().uuid(),
  dose_value: z.number().positive().max(100000).nullable().optional(),
  dose_unit: z.enum(DOSE_UNIT).nullable().optional(),
  route: z.enum(ROUTE).nullable().optional(),
  frequency: z.string().trim().min(1).max(80).nullable().optional(),
  schedule_id: z.string().uuid().nullable().optional(),
  source: z.enum(REGIMEN_ITEM_SOURCE).default("user"),
  starts_on: z.coerce.date().nullable().optional(),
  ends_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type RegimenItemInput = z.infer<typeof regimenItemInput>;

// Append-only change-log row (the versioning spine).
export const regimenChangeInsert = z.object({
  item_id: z.string().uuid().nullable().optional(),
  kind: z.enum(REGIMEN_CHANGE_KIND),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  effective_on: z.coerce.date().default(() => new Date()),
});
export type RegimenChangeInsert = z.infer<typeof regimenChangeInsert>;

// Each dose taken
export const doseLogInput = z.object({
  // Back-reference to the regimen item this dose realizes (preferred).
  regimen_item_id: z.string().uuid().nullable().optional(),
  // Legacy stack-item reference — retained for backward compatibility.
  stack_item_id: z.string().uuid().nullable().optional(),
  compound_id: z.string().uuid(),
  taken_at: z.coerce.date().default(() => new Date()),
  dose_value: z.number().positive().max(100000),
  dose_unit: z.enum(DOSE_UNIT),
  route: z.enum(ROUTE),
  injection_site: z.string().max(80).nullable().optional(),
  adherence: z.enum(ADHERENCE).default("taken"),
  side_effects: z.array(z.string().max(120)).max(20).default([]),
  notes: z.string().max(500).nullable().optional(),
});
export type DoseLogInput = z.infer<typeof doseLogInput>;

// Reconstitution calc (pure inputs, no persistence)
export const reconstitutionInput = z.object({
  vial_mg: z.number().positive().max(1000),
  bac_water_ml: z.number().positive().max(100),
  desired_dose_mg: z.number().positive().max(1000),
  syringe_units_per_ml: z.number().int().positive().max(1000).optional(),
  // Phase 12 planning extras (all optional — calc works without them)
  doses_per_week: z.number().positive().max(21).optional(),
  vial_cost_usd: z.number().min(0).max(100000).optional(),
  barrel_capacity_units: z.number().int().positive().max(100).optional(),
});
export type ReconstitutionInput = z.infer<typeof reconstitutionInput>;

// Reverse mode — drew N units, what dose is that?
export const reverseDoseInput = z.object({
  vial_mg: z.number().positive().max(1000),
  bac_water_ml: z.number().positive().max(100),
  insulin_units: z.number().positive().max(1000),
  syringe_units_per_ml: z.number().int().positive().max(1000),
});
export type ReverseDoseInput = z.infer<typeof reverseDoseInput>;

// Save a reconstitution mix to history
export const reconstitutionRecordInput = z.object({
  compound_id: z.string().uuid().nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  vial_mg: z.number().positive().max(1000),
  bac_water_ml: z.number().positive().max(100),
  concentration_mg_per_ml: z.number().positive().max(100000),
  desired_dose_mg: z.number().positive().max(1000).nullable().optional(),
  syringe_units_per_ml: z.number().int().positive().max(1000).nullable().optional(),
  draw_ml: z.number().positive().max(100).nullable().optional(),
  insulin_units: z.number().min(0).max(100000).nullable().optional(),
  vial_cost_usd: z.number().min(0).max(100000).nullable().optional(),
  reconstituted_on: z.coerce.date().default(() => new Date()),
  notes: z.string().max(500).nullable().optional(),
});
export type ReconstitutionRecordInput = z.infer<typeof reconstitutionRecordInput>;

// Protocol titration schedule — week-by-week. DOSES ARE USER/CLINICIAN-SUPPLIED.
export const scheduleWeekInput = z.object({
  compound_id: z.string().uuid(),
  week_number: z.number().int().min(1).max(104),
  dose_value: z.number().positive().max(100000),
  dose_unit: z.enum(DOSE_UNIT),
  route: z.enum(ROUTE),
  frequency: z.string().trim().min(1).max(80),
  notes: z.string().max(500).nullable().optional(),
});
export type ScheduleWeekInput = z.infer<typeof scheduleWeekInput>;

// Educational literature dose-range reference row (read-only from client).
// Lives in its own table, separate from the dose-free `compounds` catalog.
export const DOSE_REFERENCE_UNIT = ["mg", "mcg", "iu", "units", "mg/kg", "mcg/kg"] as const;
export type DoseReferenceUnit = (typeof DOSE_REFERENCE_UNIT)[number];

export const doseReferenceCitation = z.object({
  source: z.string().max(200).optional(),
  title: z.string().max(400).optional(),
  url: z.string().url().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export const compoundDoseReferenceRow = z.object({
  id: z.string().uuid(),
  compound_id: z.string().uuid(),
  context: z.string(),
  route: z.enum(ROUTE).nullable(),
  low_value: z.number().min(0).nullable(),
  high_value: z.number().min(0).nullable(),
  unit: z.enum(DOSE_REFERENCE_UNIT),
  frequency: z.string().nullable(),
  evidence_level: z.enum(EVIDENCE_LEVEL),
  is_human_data: z.boolean(),
  citation: z.array(doseReferenceCitation).default([]),
  notes: z.string().nullable(),
  is_demo: z.boolean(),
  created_at: z.coerce.date(),
});
export type CompoundDoseReferenceRow = z.infer<typeof compoundDoseReferenceRow>;

// Educational "commonly combined with…" synergy reference (read-only from client).
export const compoundSynergyRow = z.object({
  id: z.string().uuid(),
  compound_id: z.string().uuid(),
  paired_name: z.string(),
  paired_compound_id: z.string().uuid().nullable(),
  rationale: z.string(),
  evidence_level: z.enum(EVIDENCE_LEVEL),
  is_human_data: z.boolean(),
  caution_notes: z.string().nullable(),
  citation: z.array(doseReferenceCitation).default([]),
  is_demo: z.boolean(),
  created_at: z.coerce.date(),
});
export type CompoundSynergyRow = z.infer<typeof compoundSynergyRow>;

export const protocolScheduleInput = z.object({
  name: z.string().trim().min(1).max(120),
  stack_id: z.string().uuid().nullable().optional(),
  phase: z.enum(GOAL_PHASE).nullable().optional(),
  start_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().default(true),
  weeks: z.array(scheduleWeekInput).min(1).max(208),
});
export type ProtocolScheduleInput = z.infer<typeof protocolScheduleInput>;

// ---------------------------------------------------------------
// Granular regimen API (Phase 2 inline add/edit drawer — PRD §5.3).
// Defined here (after reconstitutionRecordInput) because add/edit embed an
// optional reconstitution mix to persist + link. DOSE VALUES ARE
// USER/CLINICIAN-SUPPLIED; nullable = undecided, never fabricated.
// ---------------------------------------------------------------

// Add one item to the user's active regimen (current phase). Optionally persist
// a reconstitution mix (linked via regimen_items.reconstitution_record_id) and
// optionally log the first dose ("Add & log first dose" save fork).
export const regimenItemAddInput = z.object({
  compound_id: z.string().uuid(),
  phase_id: z.string().uuid().nullable().optional(),
  dose_value: z.number().positive().max(100000).nullable().optional(),
  dose_unit: z.enum(DOSE_UNIT).nullable().optional(),
  route: z.enum(ROUTE).nullable().optional(),
  frequency: z.string().trim().min(1).max(80).nullable().optional(),
  source: z.enum(REGIMEN_ITEM_SOURCE).default("user"),
  starts_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reconstitution: reconstitutionRecordInput.optional(),
  log_first_dose: z.boolean().default(false),
  injection_site: z.string().max(80).nullable().optional(),
});
export type RegimenItemAddInput = z.infer<typeof regimenItemAddInput>;

// Edit an existing regimen item. All fields optional; a dose change is recorded
// as a 'dose_change' entry in the change log (else 'edit').
export const regimenItemPatchInput = z.object({
  dose_value: z.number().positive().max(100000).nullable().optional(),
  dose_unit: z.enum(DOSE_UNIT).nullable().optional(),
  route: z.enum(ROUTE).nullable().optional(),
  frequency: z.string().trim().min(1).max(80).nullable().optional(),
  starts_on: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reconstitution: reconstitutionRecordInput.optional(),
});
export type RegimenItemPatchInput = z.infer<typeof regimenItemPatchInput>;

// Stop (end) an item — records a 'stop' change with the prior state.
export const regimenItemStopInput = z.object({
  ends_on: z.coerce.date().default(() => new Date()),
  notes: z.string().max(500).nullable().optional(),
});
export type RegimenItemStopInput = z.infer<typeof regimenItemStopInput>;

// Advance the regimen to a new phase: closes the current open phase(s) and opens
// a new one. Records a 'phase_advance' change.
export const regimenPhaseAdvanceInput = z.object({
  name: z.string().trim().min(1).max(120),
  legacy_phase: z.enum(GOAL_PHASE).nullable().optional(),
  starts_on: z.coerce.date().default(() => new Date()),
  notes: z.string().max(2000).nullable().optional(),
  close_current: z.boolean().default(true),
});
export type RegimenPhaseAdvanceInput = z.infer<typeof regimenPhaseAdvanceInput>;
