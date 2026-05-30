import { reverseDoseInput } from "@peptide/shared";
import { doseFromUnits } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reverse mode: "I drew N units — what dose is that?"
export async function POST(req: Request) {
  try {
    await requireUser();
    const data = await parseJson(req, reverseDoseInput);
    const result = doseFromUnits({
      vialMg: data.vial_mg,
      bacWaterMl: data.bac_water_ml,
      insulinUnits: data.insulin_units,
      syringeUnitsPerMl: data.syringe_units_per_ml,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
