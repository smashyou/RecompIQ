import { reconstitutionInput } from "@peptide/shared";
import { reconstitute } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireUser();
    const data = await parseJson(req, reconstitutionInput);
    const result = reconstitute({
      vialMg: data.vial_mg,
      bacWaterMl: data.bac_water_ml,
      desiredDoseMg: data.desired_dose_mg,
      syringeUnitsPerMl: data.syringe_units_per_ml,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
