// Pure reconstitution math. Phase 6 shipped the core; Phase 12 adds the
// planning layer (days-of-supply, cost-per-dose), reverse mode, and a syringe
// visual model. All functions are pure and unit-tested via
// scripts/test-reconstitution.mjs.

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

// Core calc — unchanged signature so Phase 6 callers + tests keep working.
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

// ---------------------------------------------------------------------------
// Planning layer — supply + cost. Adds nothing prescriptive; it just answers
// "how long does this vial last and what does each dose cost" from numbers the
// user already entered.
// ---------------------------------------------------------------------------

export interface ReconstitutionPlanInput extends ReconstitutionInput {
  dosesPerWeek?: number; // for days-of-supply (e.g. 7 = daily, 3.5 = EOD)
  vialCostUsd?: number; // for cost-per-dose
}

export interface ReconstitutionPlan extends ReconstitutionResult {
  dosesPerVial: number;
  daysOfSupply: number | null;
  costPerDoseUsd: number | null;
  costPerVialUsd: number | null;
}

export function reconstitutePlan(input: ReconstitutionPlanInput): ReconstitutionPlan {
  const base = reconstitute(input);
  const dosesPerVial = input.vialMg / input.desiredDoseMg;

  const daysOfSupply =
    input.dosesPerWeek && input.dosesPerWeek > 0
      ? (dosesPerVial * 7) / input.dosesPerWeek
      : null;

  const costPerVialUsd =
    input.vialCostUsd && input.vialCostUsd >= 0 ? input.vialCostUsd : null;
  const costPerDoseUsd =
    costPerVialUsd !== null && dosesPerVial > 0 ? costPerVialUsd / dosesPerVial : null;

  return { ...base, dosesPerVial, daysOfSupply, costPerDoseUsd, costPerVialUsd };
}

// ---------------------------------------------------------------------------
// Reverse mode — "I drew N units on my syringe; what dose is that?"
// Useful for verifying a mix or back-calculating after the fact.
// ---------------------------------------------------------------------------

export interface ReverseDoseInput {
  vialMg: number;
  bacWaterMl: number;
  insulinUnits: number;
  syringeUnitsPerMl: number; // calibration of the syringe used (e.g. 100)
}

export interface ReverseDoseResult {
  concentrationMgPerMl: number;
  drawMl: number;
  doseMg: number;
  doseMcg: number;
}

export function doseFromUnits(input: ReverseDoseInput): ReverseDoseResult {
  if (
    input.vialMg <= 0 ||
    input.bacWaterMl <= 0 ||
    input.insulinUnits <= 0 ||
    input.syringeUnitsPerMl <= 0
  ) {
    throw new Error("All reverse-dose inputs must be > 0");
  }
  const concentrationMgPerMl = input.vialMg / input.bacWaterMl;
  const drawMl = input.insulinUnits / input.syringeUnitsPerMl;
  const doseMg = drawMl * concentrationMgPerMl;
  return { concentrationMgPerMl, drawMl, doseMg, doseMcg: doseMg * 1000 };
}

// ---------------------------------------------------------------------------
// Syringe visual model — generates tick marks + fill level for an SVG syringe.
// `syringeUnitsPerMl` is the calibration (U-100 = 100 units/mL). `barrel
// capacityUnits` is the physical barrel size (30 / 50 / 100 unit barrels).
// ---------------------------------------------------------------------------

export interface SyringeModelInput {
  syringeUnitsPerMl: number;
  barrelCapacityUnits: number;
  fillUnits: number;
}

export interface SyringeTick {
  units: number;
  major: boolean;
}

export interface SyringeModel {
  capacityUnits: number;
  fillUnits: number;
  fillFraction: number; // 0..1, clamped for rendering
  overfilled: boolean; // true when the dose exceeds barrel capacity
  ticks: SyringeTick[];
}

export function syringeModel(input: SyringeModelInput): SyringeModel {
  const capacityUnits = input.barrelCapacityUnits;
  const fillUnits = input.fillUnits;
  const overfilled = fillUnits > capacityUnits;
  const fillFraction = capacityUnits > 0 ? Math.min(1, Math.max(0, fillUnits / capacityUnits)) : 0;

  // Tick spacing scales with barrel size so the visual stays readable.
  const minorStep = capacityUnits <= 50 ? 1 : 2;
  const majorStep = capacityUnits <= 50 ? 5 : 10;

  const ticks: SyringeTick[] = [];
  for (let u = 0; u <= capacityUnits + 1e-9; u += minorStep) {
    const units = Number(u.toFixed(2));
    ticks.push({ units, major: Math.abs(units % majorStep) < 1e-9 });
  }
  return { capacityUnits, fillUnits, fillFraction, overfilled, ticks };
}

// Common insulin-syringe barrel sizes (US U-100). The UI offers these.
export const SYRINGE_BARRELS = [
  { capacityUnits: 30, label: "0.3 mL (30 units)" },
  { capacityUnits: 50, label: "0.5 mL (50 units)" },
  { capacityUnits: 100, label: "1.0 mL (100 units)" },
] as const;

// Supported syringe calibrations (units per mL). U-100 is standard in the US;
// U-40 still appears on some international + veterinary syringes.
export const SYRINGE_CALIBRATIONS = [
  { unitsPerMl: 100, label: "U-100 (100 units / mL)" },
  { unitsPerMl: 50, label: "U-50 (50 units / mL)" },
  { unitsPerMl: 40, label: "U-40 (40 units / mL)" },
] as const;
