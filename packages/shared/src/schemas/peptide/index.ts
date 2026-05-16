import { z } from "zod";
import { ADHERENCE, GOAL_PHASE, ROUTE } from "../../enums/index";

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

// Each dose taken
export const doseLogInput = z.object({
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
});
export type ReconstitutionInput = z.infer<typeof reconstitutionInput>;
