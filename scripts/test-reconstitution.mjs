#!/usr/bin/env node
// Tiny test harness for the reconstitution math. Runs via `pnpm test:reconstitution`.
// No Vitest — keeps the engine runnable from a bare Node install (through tsx).

import assert from "node:assert/strict";
import {
  reconstitute,
  reconstitutePlan,
  doseFromUnits,
  syringeModel,
} from "../packages/peptides/src/reconstitution.ts";

let passed = 0;
let failed = 0;
function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}\n     ${err.message}`);
    failed++;
  }
}
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---- core (Phase 6 behavior preserved) ----
it("concentration = vialMg / bacWaterMl", () => {
  const r = reconstitute({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5 });
  assert.ok(close(r.concentrationMgPerMl, 5));
  assert.ok(close(r.drawMl, 0.1));
  assert.equal(r.insulinUnits, null);
});

it("insulin units when syringe calibration given (U-100)", () => {
  const r = reconstitute({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5, syringeUnitsPerMl: 100 });
  assert.ok(close(r.insulinUnits, 10)); // 0.1 mL * 100 u/mL
});

it("throws on non-positive input", () => {
  assert.throws(() => reconstitute({ vialMg: 0, bacWaterMl: 1, desiredDoseMg: 1 }));
  assert.throws(() => reconstitute({ vialMg: 1, bacWaterMl: -1, desiredDoseMg: 1 }));
});

// ---- planning layer ----
it("dosesPerVial = vialMg / desiredDoseMg", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5 });
  assert.ok(close(p.dosesPerVial, 20));
});

it("daysOfSupply for daily dosing (7/wk)", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5, dosesPerWeek: 7 });
  assert.ok(close(p.daysOfSupply, 20)); // 20 doses / (7/7 per day) = 20 days
});

it("daysOfSupply for EOD dosing (3.5/wk)", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5, dosesPerWeek: 3.5 });
  assert.ok(close(p.daysOfSupply, 40)); // 20 doses * 7 / 3.5 = 40 days
});

it("daysOfSupply null when no frequency", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5 });
  assert.equal(p.daysOfSupply, null);
});

it("costPerDose = vialCost / dosesPerVial", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5, vialCostUsd: 100 });
  assert.ok(close(p.costPerDoseUsd, 5)); // 100 / 20
});

it("cost fields null when no cost given", () => {
  const p = reconstitutePlan({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5 });
  assert.equal(p.costPerDoseUsd, null);
  assert.equal(p.costPerVialUsd, null);
});

// ---- reverse mode ----
it("doseFromUnits round-trips with reconstitute", () => {
  const fwd = reconstitute({ vialMg: 10, bacWaterMl: 2, desiredDoseMg: 0.5, syringeUnitsPerMl: 100 });
  const rev = doseFromUnits({ vialMg: 10, bacWaterMl: 2, insulinUnits: fwd.insulinUnits, syringeUnitsPerMl: 100 });
  assert.ok(close(rev.doseMg, 0.5));
  assert.ok(close(rev.doseMcg, 500));
});

it("doseFromUnits throws on non-positive", () => {
  assert.throws(() => doseFromUnits({ vialMg: 10, bacWaterMl: 2, insulinUnits: 0, syringeUnitsPerMl: 100 }));
});

// ---- syringe model ----
it("syringe fill fraction within barrel", () => {
  const m = syringeModel({ syringeUnitsPerMl: 100, barrelCapacityUnits: 100, fillUnits: 10 });
  assert.ok(close(m.fillFraction, 0.1));
  assert.equal(m.overfilled, false);
});

it("syringe overfill flagged + fraction clamped", () => {
  const m = syringeModel({ syringeUnitsPerMl: 100, barrelCapacityUnits: 30, fillUnits: 45 });
  assert.equal(m.overfilled, true);
  assert.equal(m.fillFraction, 1);
});

it("syringe ticks include 0 and capacity, majors at 10 for 100-barrel", () => {
  const m = syringeModel({ syringeUnitsPerMl: 100, barrelCapacityUnits: 100, fillUnits: 10 });
  assert.equal(m.ticks[0].units, 0);
  assert.equal(m.ticks[m.ticks.length - 1].units, 100);
  const major = m.ticks.find((t) => t.units === 50);
  assert.equal(major.major, true);
  const minor = m.ticks.find((t) => t.units === 4);
  assert.equal(minor.major, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
