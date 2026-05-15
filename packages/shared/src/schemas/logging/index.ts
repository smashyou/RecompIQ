import { z } from "zod";
import { UNIT_WEIGHT, LOG_SOURCE } from "../../enums/index";

// Convert FOO="" to undefined for optional numeric fields parsed from form data.
const optNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : typeof v === "string" ? Number(v) : v),
  z.number().optional(),
);

export const weightLogInput = z.object({
  value: z.number().min(50).max(800),
  unit: z.enum(UNIT_WEIGHT).default("lb"),
  logged_at: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).nullable().optional(),
  source: z.enum(LOG_SOURCE).default("manual"),
});
export type WeightLogInput = z.infer<typeof weightLogInput>;

export const vitalLogInput = z
  .object({
    logged_at: z.coerce.date().default(() => new Date()),
    bp_systolic: optNumber.pipe(z.number().int().min(40).max(260).optional()),
    bp_diastolic: optNumber.pipe(z.number().int().min(20).max(180).optional()),
    hr: optNumber.pipe(z.number().int().min(20).max(240).optional()),
    glucose_mgdl: optNumber.pipe(z.number().min(20).max(1000).optional()),
    ketones_mmol: optNumber.pipe(z.number().min(0).max(10).optional()),
    temp_f: optNumber.pipe(z.number().min(85).max(110).optional()),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      v.bp_systolic !== undefined ||
      v.bp_diastolic !== undefined ||
      v.hr !== undefined ||
      v.glucose_mgdl !== undefined ||
      v.ketones_mmol !== undefined ||
      v.temp_f !== undefined,
    { message: "Enter at least one vital reading" },
  );
export type VitalLogInput = z.infer<typeof vitalLogInput>;

export const symptomLogInput = z.object({
  logged_at: z.coerce.date().default(() => new Date()),
  mood: optNumber.pipe(z.number().int().min(1).max(5).optional()),
  energy: optNumber.pipe(z.number().int().min(1).max(5).optional()),
  pain: optNumber.pipe(z.number().int().min(0).max(10).optional()),
  appetite: optNumber.pipe(z.number().int().min(1).max(5).optional()),
  nausea: z.boolean().optional(),
  reflux: z.boolean().optional(),
  constipation: z.boolean().optional(),
  neuro_note: z.string().max(500).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
export type SymptomLogInput = z.infer<typeof symptomLogInput>;

export const sleepLogInput = z.object({
  night_of: z.coerce.date(),
  duration_min: z.number().int().min(0).max(1440),
  quality: z.number().int().min(1).max(5).optional(),
  note: z.string().max(500).nullable().optional(),
});
export type SleepLogInput = z.infer<typeof sleepLogInput>;

export const waterLogInput = z.object({
  logged_at: z.coerce.date().default(() => new Date()),
  volume_oz: z.number().min(0).max(500),
});
export type WaterLogInput = z.infer<typeof waterLogInput>;

export const stepsLogInput = z.object({
  day: z.coerce.date(),
  count: z.number().int().min(0).max(100000),
  source: z.enum(LOG_SOURCE).default("manual"),
});
export type StepsLogInput = z.infer<typeof stepsLogInput>;
