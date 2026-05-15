import { z } from "zod";
import { ROUTE } from "../../enums/index";

const medicationItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(80).nullable().optional(),
  route: z.enum(ROUTE).nullable().optional(),
  started_at: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
});

export const medicationsStepSchema = z.object({
  items: z.array(medicationItemSchema).max(50),
});
export type MedicationsStep = z.infer<typeof medicationsStepSchema>;
export type MedicationItem = z.infer<typeof medicationItemSchema>;
