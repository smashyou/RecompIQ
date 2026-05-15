import { z } from "zod";

const injuryItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(500).nullable().optional(),
  occurred_at: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
});

export const injuriesStepSchema = z.object({
  items: z.array(injuryItemSchema).max(50),
});
export type InjuriesStep = z.infer<typeof injuriesStepSchema>;
export type InjuryItem = z.infer<typeof injuryItemSchema>;
