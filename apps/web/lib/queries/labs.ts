import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shapeLabSeries, type LabReadingRow, type MarkerSeries } from "@/lib/labs-shape";

export interface LabsSnapshot {
  rows: LabReadingRow[];
  series: MarkerSeries[];
}

export async function loadLabs(userId: string): Promise<LabsSnapshot> {
  const supabase = await createSupabaseServerClient();
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
