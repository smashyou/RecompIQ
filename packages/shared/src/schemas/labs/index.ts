import { z } from "zod";

// Labs / biomarkers (REGIMEN_GOALS_PRD §4.4). A lab_results row is a single
// marker reading. Values are user-supplied or OCR'd from a user's own report —
// the app flags out-of-range values for discussion, it does not diagnose.

export const LAB_SOURCE = ["manual", "ocr"] as const;
export type LabSource = (typeof LAB_SOURCE)[number];

// A single confirmed/entered marker reading (insert payload).
export const labResultInput = z.object({
  panel: z.string().trim().max(60).nullable().optional(),
  marker: z.string().trim().min(1).max(120), // display name (raw or catalog label)
  marker_key: z.string().trim().max(60).nullable().optional(), // catalog key when recognized
  value: z.number().finite(),
  unit: z.string().trim().max(40).nullable().optional(),
  ref_low: z.number().finite().nullable().optional(),
  ref_high: z.number().finite().nullable().optional(),
  collected_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  source: z.enum(LAB_SOURCE).default("manual"),
  photo_url: z.string().url().max(2048).nullable().optional(),
});
export type LabResultInput = z.infer<typeof labResultInput>;

// Bulk create (manual single, or confirming an OCR batch). ocr_raw is attached
// server-side, not by the client.
export const labResultsCreateInput = z.object({
  results: z.array(labResultInput).min(1).max(80),
  // Full parser output, attached to source='ocr' rows for provenance/audit.
  ocr_raw: z.unknown().optional(),
});
export type LabResultsCreateInput = z.infer<typeof labResultsCreateInput>;

// One marker as returned by the vision/text OCR parser.
export const labOcrMarker = z.object({
  marker_key: z.string().trim().max(60).nullable().optional(), // model's best catalog map (re-validated server-side)
  raw_name: z.string().trim().min(1).max(160),
  value: z.number().finite(),
  unit: z.string().trim().max(40).nullable().optional(),
  ref_low: z.number().finite().nullable().optional(),
  ref_high: z.number().finite().nullable().optional(),
  flag: z.enum(["low", "high", "normal"]).nullable().optional(),
});
export type LabOcrMarker = z.infer<typeof labOcrMarker>;

export const labOcrParseResult = z.object({
  collected_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  results: z.array(labOcrMarker).max(80),
});
export type LabOcrParseResult = z.infer<typeof labOcrParseResult>;

// API: parse step. Operates on an already-uploaded asset (Blob URL + kind).
export const labParseInput = z.object({
  blob_url: z.string().url().max(2048),
  kind: z.enum(["image", "pdf"]),
  model: z.string().max(120).optional(),
});
export type LabParseInput = z.infer<typeof labParseInput>;
