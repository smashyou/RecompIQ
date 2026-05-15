// Pure reconstitution math. Fully implemented in Phase 6 with tests.

export interface ReconstitutionInput {
  vialMg: number; // total mg in vial
  bacWaterMl: number; // volume of bacteriostatic water added
  desiredDoseMg: number; // dose to deliver
  syringeUnitsPerMl?: number; // e.g. 100 for U-100 insulin syringe
}

export interface ReconstitutionResult {
  concentrationMgPerMl: number;
  drawMl: number;
  insulinUnits: number | null;
}

export function reconstitute(input: ReconstitutionInput): ReconstitutionResult {
  if (input.vialMg <= 0 || input.bacWaterMl <= 0 || input.desiredDoseMg <= 0) {
    throw new Error("All reconstitution inputs must be > 0");
  }
  const concentrationMgPerMl = input.vialMg / input.bacWaterMl;
  const drawMl = input.desiredDoseMg / concentrationMgPerMl;
  const insulinUnits =
    input.syringeUnitsPerMl && input.syringeUnitsPerMl > 0
      ? drawMl * input.syringeUnitsPerMl
      : null;
  return { concentrationMgPerMl, drawMl, insulinUnits };
}
