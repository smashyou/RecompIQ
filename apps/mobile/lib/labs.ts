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

export async function deleteLab(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("lab_results")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
