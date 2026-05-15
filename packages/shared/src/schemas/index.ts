import { z } from "zod";
import { SEX, UNIT_LENGTH, UNIT_WEIGHT, GOAL_PHASE } from "../enums/index";

export * from "./onboarding/index";
export * from "./logging/index";

export const profileSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(120).nullable().optional(),
  dob: z.coerce.date().nullable().optional(),
  sex: z.enum(SEX),
  height_in: z.number().min(36).max(96).nullable().optional(),
  unit_weight: z.enum(UNIT_WEIGHT).default("lb"),
  unit_length: z.enum(UNIT_LENGTH).default("in"),
  is_demo: z.boolean().default(false),
});
export type Profile = z.infer<typeof profileSchema>;

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  start_weight_lb: z.number().min(50).max(800),
  goal_weight_lb_min: z.number().min(50).max(800),
  goal_weight_lb_max: z.number().min(50).max(800),
  timeline_weeks: z.number().int().min(1).max(260),
  phase: z.enum(GOAL_PHASE).default("P1"),
  protein_target_g_min: z.number().int().min(20).max(400),
  protein_target_g_max: z.number().int().min(20).max(400),
});
export type Goal = z.infer<typeof goalSchema>;

export const weightLogSchema = z.object({
  value: z.number().min(50).max(800),
  unit: z.enum(UNIT_WEIGHT),
  logged_at: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).nullable().optional(),
});
export type WeightLog = z.infer<typeof weightLogSchema>;

export const vitalLogSchema = z.object({
  logged_at: z.coerce.date().default(() => new Date()),
  bp_systolic: z.number().int().min(40).max(260).nullable().optional(),
  bp_diastolic: z.number().int().min(20).max(180).nullable().optional(),
  hr: z.number().int().min(20).max(240).nullable().optional(),
  glucose_mgdl: z.number().min(20).max(1000).nullable().optional(),
  ketones_mmol: z.number().min(0).max(10).nullable().optional(),
  temp_f: z.number().min(85).max(110).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
export type VitalLog = z.infer<typeof vitalLogSchema>;
