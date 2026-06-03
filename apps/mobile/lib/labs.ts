import {
  shapeLabSeries,
  matchMarkerKey,
  effectiveRange,
  LAB_MARKER_BY_KEY,
  type LabReadingRow,
  type MarkerSeries,
} from "@peptide/shared";
import { supabase } from "@/lib/supabase";

export type { LabReadingRow, MarkerSeries };

export async function loadLabs(userId: string): Promise<{
  rows: LabReadingRow[];
  series: MarkerSeries[];
}> {
  const { data } = await supabase
    .from("lab_results")
    .select(
      "id, panel, marker, marker_key, value, unit, ref_low, ref_high, collected_on, source, photo_url, created_at",
    )
    .eq("user_id", userId)
    .order("collected_on", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as LabReadingRow[];
  return { rows, series: shapeLabSeries(rows) };
}

export interface ManualLabInput {
  markerKey: string | null;
  customName: string;
  value: number;
  unit: string | null;
  collectedOn: string; // YYYY-MM-DD
}

export async function addManualLab(userId: string, input: ManualLabInput): Promise<void> {
  const def = input.markerKey ? LAB_MARKER_BY_KEY[input.markerKey] : undefined;
  const marker = def?.label ?? input.customName.trim();
  const key = input.markerKey || matchMarkerKey(marker);
  const range = effectiveRange(key, null, null);
  const { error } = await supabase.from("lab_results").insert({
    user_id: userId,
    panel: def?.panel ?? null,
    marker,
    marker_key: key,
    value: input.value,
    unit: input.unit ?? def?.unit ?? null,
    ref_low: range.low,
    ref_high: range.high,
    collected_on: input.collectedOn,
    source: "manual",
  });
  if (error) throw error;
}

export interface OcrLabRow {
  markerKey: string | null;
  marker: string;
  panel: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
}

// Bulk insert of OCR-reviewed markers. One lab_results row per included marker,
// mirroring addManualLab's shape but tagged source: "ocr" with the report blob
// URL. The caller has already let the user review/edit/skip every row.
export async function addOcrLabs(
  userId: string,
  rows: OcrLabRow[],
  opts: { collectedOn: string; photoUrl: string | null },
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: userId,
    panel: r.panel,
    marker: r.marker,
    marker_key: r.markerKey,
    value: r.value,
    unit: r.unit,
    ref_low: r.refLow,
    ref_high: r.refHigh,
    collected_on: opts.collectedOn,
    source: "ocr",
    photo_url: opts.photoUrl,
  }));
  const { error } = await supabase.from("lab_results").insert(payload);
  if (error) throw error;
}

export async function deleteLab(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("lab_results")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
