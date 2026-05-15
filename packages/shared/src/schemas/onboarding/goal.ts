import { z } from "zod";
import { GOAL_PHASE } from "../../enums/index";

export const goalStepSchema = z
  .object({
    start_weight_lb: z.number().min(50).max(800),
    goal_weight_lb_min: z.number().min(50).max(800),
    goal_weight_lb_max: z.number().min(50).max(800),
    timeline_weeks: z.number().int().min(1).max(260),
    phase: z.enum(GOAL_PHASE).default("P1"),
    protein_target_g_min: z.number().int().min(20).max(400),
    protein_target_g_max: z.number().int().min(20).max(400),
  })
  .refine((d) => d.goal_weight_lb_min <= d.goal_weight_lb_max, {
    message: "Lower goal weight must be ≤ upper",
    path: ["goal_weight_lb_min"],
  })
  .refine((d) => d.protein_target_g_min <= d.protein_target_g_max, {
    message: "Lower protein target must be ≤ upper",
    path: ["protein_target_g_min"],
  })
  .refine((d) => d.goal_weight_lb_max <= d.start_weight_lb + 50, {
    message: "Goal weight is implausibly higher than starting weight",
    path: ["goal_weight_lb_max"],
  });

export type GoalStep = z.infer<typeof goalStepSchema>;
