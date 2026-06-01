// Phase 6: labs/biomarkers — list + bulk create.
// GET  → all of the current user's lab readings (newest first).
// POST → bulk-insert confirmed/manual readings. Used by both the OCR-confirm
//        flow (source='ocr') and the manual single-marker form (source='manual').

import { labResultsCreateInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lab_results")
      .select(
        "id, panel, marker, marker_key, value, unit, ref_low, ref_high, collected_on, source, photo_url, created_at",
      )
      .eq("user_id", user.id)
      .order("collected_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return jsonOk({ results: data ?? [] });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { results, ocr_raw } = await parseJson(req, labResultsCreateInput);

    const supabase = await createSupabaseServerClient();
    const rows = results.map((r) => ({
      user_id: user.id,
      panel: r.panel ?? null,
      marker: r.marker,
      marker_key: r.marker_key ?? null,
      value: r.value,
      unit: r.unit ?? null,
      ref_low: r.ref_low ?? null,
      ref_high: r.ref_high ?? null,
      collected_on: r.collected_on,
      source: r.source,
      photo_url: r.photo_url ?? null,
      // Provenance only on OCR-sourced rows; keep manual rows lean.
      ocr_raw: r.source === "ocr" ? (ocr_raw ?? null) : null,
    }));

    const { data, error } = await supabase
      .from("lab_results")
      .insert(rows)
      .select("id, panel, marker, marker_key, value, unit, ref_low, ref_high, collected_on, source, photo_url, created_at");
    if (error) throw error;

    return jsonOk({ results: data ?? [], inserted: data?.length ?? 0 });
  } catch (err) {
    return jsonError(err);
  }
}
