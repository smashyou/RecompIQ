import { reconstitutionInput } from "@peptide/shared";
import { reconstitutePlan, syringeModel } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireUser();
    const data = await parseJson(req, reconstitutionInput);

    const plan = reconstitutePlan({
      vialMg: data.vial_mg,
      bacWaterMl: data.bac_water_ml,
      desiredDoseMg: data.desired_dose_mg,
      syringeUnitsPerMl: data.syringe_units_per_ml,
      dosesPerWeek: data.doses_per_week,
      vialCostUsd: data.vial_cost_usd,
    });

    // Visual syringe model when both a calibration and a barrel size are known.
    const syringe =
      data.syringe_units_per_ml && data.barrel_capacity_units && plan.insulinUnits !== null
        ? syringeModel({
            syringeUnitsPerMl: data.syringe_units_per_ml,
            barrelCapacityUnits: data.barrel_capacity_units,
            fillUnits: plan.insulinUnits,
          })
        : null;

    return jsonOk({ ...plan, syringe });
  } catch (err) {
    return jsonError(err);
  }
}
