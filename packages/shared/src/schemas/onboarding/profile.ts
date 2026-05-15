import { z } from "zod";
import { SEX, UNIT_LENGTH, UNIT_WEIGHT } from "../../enums/index";

export const profileStepSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  dob: z.coerce.date().refine((d) => {
    const now = Date.now();
    const age = (now - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 13 && age <= 120;
  }, "Age must be between 13 and 120"),
  sex: z.enum(SEX),
  height_in: z.number({ invalid_type_error: "Required" }).min(36).max(96),
  unit_weight: z.enum(UNIT_WEIGHT).default("lb"),
  unit_length: z.enum(UNIT_LENGTH).default("in"),
});
export type ProfileStep = z.infer<typeof profileStepSchema>;
