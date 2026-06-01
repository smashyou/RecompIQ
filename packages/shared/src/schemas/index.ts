import { z } from "zod";
import { SEX, UNIT_LENGTH, UNIT_WEIGHT, GOAL_PHASE } from "../enums/index";
import { GOAL_KEYS, GOAL_STATUS } from "../goals/taxonomy";
import { METRIC_BY_KEY } from "../goals/metrics";

export * from "./onboarding/index";
export * from "./logging/index";
export * from "./food/index";
export * from "./food/photo";
export * from "./peptide/index";
export * from "./workout/index";
export * from "./settings/index";
export * from "./labs/index";
export * from "./alerts";

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

// Goal-driven model (REGIMEN_GOALS_PRD §4.3). One row per chosen goal.
export const userGoalInput = z.object({
  goal_key: z.enum(GOAL_KEYS),
  priority: z.number().int().min(1).max(20).default(1),
  status: z.enum(GOAL_STATUS).default("active"),
  target: z.record(z.unknown()).default({}),
  notes: z.string().max(1000).nullable().optional(),
});
export type UserGoalInput = z.infer<typeof userGoalInput>;

// Replace the user's whole goal set (the multi-select picker save).
export const userGoalsReplaceInput = z.object({
  goals: z.array(userGoalInput).max(20),
});
export type UserGoalsReplaceInput = z.infer<typeof userGoalsReplaceInput>;

// Goal-metric logging (REGIMEN_GOALS_PRD §5.6). A single self-reported metric
// point. metric_key is validated against the shared METRIC catalog.
export const goalMetricInput = z
  .object({
    metric_key: z.string().refine((k) => k in METRIC_BY_KEY, "Unknown metric"),
    value: z.number().finite(),
    unit: z.string().max(20).nullable().optional(),
    goal_key: z.enum(GOAL_KEYS).nullable().optional(),
    logged_at: z.coerce.date().default(() => new Date()),
    note: z.string().max(500).nullable().optional(),
  })
  // Enforce the catalog's per-metric bounds (ratings 0–10, cm, ms, score) so a
  // malformed value can't reach the DB and skew the projection charts.
  .superRefine((data, ctx) => {
    const def = METRIC_BY_KEY[data.metric_key];
    if (def && (data.value < def.min || data.value > def.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `${data.metric_key} must be between ${def.min} and ${def.max}`,
      });
    }
  });
export type GoalMetricInput = z.infer<typeof goalMetricInput>;

export const goalMetricsBatchInput = z.object({
  metrics: z.array(goalMetricInput).min(1).max(30),
});
export type GoalMetricsBatchInput = z.infer<typeof goalMetricsBatchInput>;

// ---------------------------------------------------------------
// AI auto-stacker (REGIMEN_GOALS_PRD §3/§7). Goal-driven SUGGESTIONS the user
// accepts/edits — never auto-applied, never a prescription. Dose text is
// literature/community range only, quarantined via wrapDoseLike before display.
// ---------------------------------------------------------------
export const stackerGenerateInput = z.object({
  goal_keys: z.array(z.enum(GOAL_KEYS)).max(13).default([]),
  free_text: z.string().max(2000).nullable().optional(),
});
export type StackerGenerateInput = z.infer<typeof stackerGenerateInput>;

// Model output (validated). Lenient strings (slug/evidence) — post-filtered to
// the catalog server-side. literature_dose_text is wrapped before it reaches UI.
export const stackerItem = z.object({
  slug: z.string(),
  name: z.string(),
  why: z.string().max(600),
  evidence_level: z.string(),
  literature_dose_text: z.string().max(400).nullable().optional(),
  monitoring: z.array(z.string().max(200)).default([]),
  cautions: z.array(z.string().max(200)).default([]),
});
export type StackerItem = z.infer<typeof stackerItem>;

export const stackerPhase = z.object({
  name: z.string().max(120),
  goal_keys: z.array(z.string()).default([]),
  rationale: z.string().max(800),
  items: z.array(stackerItem).max(12).default([]),
});
export type StackerPhase = z.infer<typeof stackerPhase>;

export const stackerPlan = z.object({
  summary: z.string().max(1200),
  detected_goal_keys: z.array(z.string()).default([]),
  phasing_rationale: z.string().max(1200),
  warnings: z.array(z.string().max(400)).default([]),
  phases: z.array(stackerPhase).max(8).default([]),
  clinician_points: z.array(z.string().max(400)).default([]),
});
export type StackerPlan = z.infer<typeof stackerPlan>;

// Apply an accepted plan: creates goals + phases + ai_suggested items.
export const stackerApplyInput = z.object({
  plan: stackerPlan,
  goal_keys: z.array(z.enum(GOAL_KEYS)).max(13).default([]),
});
export type StackerApplyInput = z.infer<typeof stackerApplyInput>;

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
