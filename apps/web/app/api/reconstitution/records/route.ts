import { reconstitutionRecordInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persist a reconstitution mix to history (reconstitution_records).
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, reconstitutionRecordInput);
    const supabase = await createSupabaseServerClient();
    const reconstitutedOn = data.reconstituted_on ?? new Date();

    const { data: row, error } = await supabase
      .from("reconstitution_records")
      .insert({
        user_id: user.id,
        compound_id: data.compound_id ?? null,
        label: data.label ?? null,
        vial_mg: data.vial_mg,
        bac_water_ml: data.bac_water_ml,
        concentration_mg_per_ml: data.concentration_mg_per_ml,
        desired_dose_mg: data.desired_dose_mg ?? null,
        syringe_units_per_ml: data.syringe_units_per_ml ?? null,
        draw_ml: data.draw_ml ?? null,
        insulin_units: data.insulin_units ?? null,
        vial_cost_usd: data.vial_cost_usd ?? null,
        reconstituted_on: reconstitutedOn.toISOString().slice(0, 10),
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    return jsonOk({ id: row.id });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("reconstitution_records")
      .select("*, compounds(slug,name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
