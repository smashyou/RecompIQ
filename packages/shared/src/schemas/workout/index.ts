import { z } from "zod";
import { GOAL_PHASE } from "../../enums/index";

export const SESSION_TYPE = ["lifting", "mobility", "cardio", "walking", "mixed"] as const;
export type SessionType = (typeof SESSION_TYPE)[number];

export const workoutInput = z.object({
  session_type: z.enum(SESSION_TYPE),
  phase: z.enum(GOAL_PHASE).nullable().optional(),
  date: z.coerce.date().default(() => new Date()),
  duration_min: z.number().int().min(0).max(480).nullable().optional(),
  perceived_exertion: z.number().int().min(1).max(10).nullable().optional(),
  template_slug: z.string().max(120).nullable().optional(),
  name: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type WorkoutInput = z.infer<typeof workoutInput>;

export const exerciseInput = z.object({
  order_index: z.number().int().min(0).max(200).default(0),
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(30).nullable().optional(),
  reps: z.number().int().min(1).max(200).nullable().optional(),
  load_lb: z.number().min(0).max(1500).nullable().optional(),
  duration_min: z.number().int().min(0).max(480).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type ExerciseInput = z.infer<typeof exerciseInput>;

export const exercisesBatchInput = z.object({
  items: z.array(exerciseInput).min(1).max(40),
});
