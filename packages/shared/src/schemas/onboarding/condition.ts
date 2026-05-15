import { z } from "zod";

const conditionItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(500).nullable().optional(),
  diagnosed_at: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
});

export const conditionsStepSchema = z.object({
  items: z.array(conditionItemSchema).max(50),
});
export type ConditionsStep = z.infer<typeof conditionsStepSchema>;
export type ConditionItem = z.infer<typeof conditionItemSchema>;
