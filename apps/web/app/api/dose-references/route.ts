import { wrapDoseLike } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DoseReferenceRow {
  id: string;
  compound_id: string;
  context: string;
  route: string | null;
  low_value: number | null;
  high_value: number | null;
  unit: string;
  frequency: string | null;
  evidence_level: string;
  is_human_data: boolean;
  citation: unknown;
  notes: string | null;
}

// Render the numeric range as a single educational string, tagged via
// wrapDoseLike so the client wraps each dose token with the [edu] badge +
// clinician disclaimer. This is reference material, NOT a prescription.
function rangeText(row: DoseReferenceRow): string {
  const u = row.unit;
  let core: string;
  if (row.low_value !== null && row.high_value !== null) {
    core = row.low_value === row.high_value ? `${row.low_value} ${u}` : `${row.low_value}–${row.high_value} ${u}`;
  } else if (row.low_value !== null) {
    core = `from ${row.low_value} ${u}`;
  } else if (row.high_value !== null) {
    core = `up to ${row.high_value} ${u}`;
  } else {
    core = "range not established";
  }
  return row.frequency ? `${core}, ${row.frequency}` : core;
}

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const compoundId = url.searchParams.get("compound_id");
    const compoundSlug = url.searchParams.get("slug");

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("compound_dose_reference")
      .select("*, compounds!inner(id,slug,name)")
      .order("context", { ascending: true });

    if (compoundId) query = query.eq("compound_id", compoundId);
    if (compoundSlug) query = query.eq("compounds.slug", compoundSlug);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as DoseReferenceRow[];
    const references = rows.map((row) => {
      const raw = rangeText(row);
      const { wrappedText, doseHits } = wrapDoseLike(raw);
      return {
        id: row.id,
        compound_id: row.compound_id,
        context: row.context,
        route: row.route,
        unit: row.unit,
        frequency: row.frequency,
        evidence_level: row.evidence_level,
        is_human_data: row.is_human_data,
        citation: row.citation,
        notes: row.notes,
        // Pre-wrapped educational range string for <DoseAnnotatedText>
        range_display: wrappedText,
        has_dose: doseHits > 0,
        // Raw numbers so the UI can prefill the calculator on "use as starting point"
        low_value: row.low_value,
        high_value: row.high_value,
      };
    });

    return jsonOk({ references });
  } catch (err) {
    return jsonError(err);
  }
}
