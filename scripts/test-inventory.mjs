#!/usr/bin/env node
// Tiny test harness for the inventory / expenses math. Runs via `pnpm test:inventory`.

import assert from "node:assert/strict";
import {
  doseToMg,
  purchaseMg,
  costPerMg,
  compoundInventory,
  filterByRange,
  spendSummary,
} from "../packages/peptides/src/inventory.ts";

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

const P = (id, compoundId, vialMg, vialCount, priceUsd, purchasedOn) => ({
  id,
  compoundId,
  vialMg,
  vialCount,
  priceUsd,
  purchasedOn,
});

// ---- unit conversion ----
it("doseToMg converts mcg→mg and passes mg through; volume units need a mix", () => {
  assert.equal(doseToMg(500, "mcg"), 0.5);
  assert.equal(doseToMg(2, "mg"), 2);
  assert.equal(doseToMg(10, "iu"), null);
  // No mix context supplied → still null, exactly as before.
  assert.equal(doseToMg(5, "units"), null);
  assert.equal(doseToMg(0.2, "ml"), null);
});

it("doseToMg: ml converts with the mix concentration", () => {
  // 5 mg vial in 2 mL bac water → 2.5 mg/mL. Drawing 0.2 mL = 0.5 mg.
  assert.ok(close(doseToMg(0.2, "ml", { concentrationMgPerMl: 2.5 }), 0.5));
});

it("doseToMg: units convert with concentration + syringe calibration", () => {
  // 5 mg / 2 mL = 2.5 mg/mL. 20 units on a U-100 syringe = 0.2 mL = 0.5 mg.
  assert.ok(close(doseToMg(20, "units", { concentrationMgPerMl: 2.5, syringeUnitsPerMl: 100 }), 0.5));
  // Same 20 units on a U-40 syringe is 0.5 mL = 1.25 mg — 2.5x more. This is
  // precisely why the calibration may not be assumed.
  assert.ok(close(doseToMg(20, "units", { concentrationMgPerMl: 2.5, syringeUnitsPerMl: 40 }), 1.25));
});

it("doseToMg: units WITHOUT a calibration stay null (never guess U-100)", () => {
  assert.equal(doseToMg(20, "units", { concentrationMgPerMl: 2.5 }), null);
  assert.equal(doseToMg(20, "units", { concentrationMgPerMl: 2.5, syringeUnitsPerMl: 0 }), null);
});

it("doseToMg: iu is never convertible even with a full mix context", () => {
  // IU is a biological-activity unit, not a volume. mg per IU is compound
  // specific and is not in the catalog, so there is nothing to convert with.
  assert.equal(doseToMg(10, "iu", { concentrationMgPerMl: 2.5, syringeUnitsPerMl: 100 }), null);
});

it("doseToMg: a missing or nonsense concentration does not silently zero out", () => {
  assert.equal(doseToMg(20, "units", { concentrationMgPerMl: null, syringeUnitsPerMl: 100 }), null);
  assert.equal(doseToMg(0.2, "ml", { concentrationMgPerMl: 0 }), null);
  assert.equal(doseToMg(-1, "mg"), null);
});

it("purchaseMg + costPerMg use total price across vials", () => {
  const p = P("1", "c", 10, 3, 90, "2026-01-01"); // 30 mg total, $90
  assert.ok(close(purchaseMg(p), 30));
  assert.ok(close(costPerMg(p), 3)); // $90 / 30 mg
});

// ---- FIFO depletion ----
it("FIFO: front vial is the oldest with product left", () => {
  const purchases = [
    P("a", "c", 10, 1, 50, "2026-01-01"), // 10 mg @ $5/mg
    P("b", "c", 10, 1, 80, "2026-02-01"), // 10 mg @ $8/mg
  ];
  // consumed 12 mg → first vial (10) fully gone, 2 mg into second vial.
  const inv = compoundInventory("c", purchases, 12, 0.5);
  assert.ok(close(inv.purchasedMg, 20));
  assert.ok(close(inv.remainingMg, 8));
  assert.ok(close(inv.currentCostPerMg, 8)); // second vial
  assert.ok(close(inv.costOfNextDoseUsd, 8 * 0.5)); // $4
  assert.ok(close(inv.remainingDoses, 8 / 0.5)); // 16 doses
});

it("FIFO: nothing consumed → front is the first vial", () => {
  const purchases = [
    P("a", "c", 10, 1, 50, "2026-01-01"),
    P("b", "c", 10, 1, 80, "2026-02-01"),
  ];
  const inv = compoundInventory("c", purchases, 0, 1);
  assert.ok(close(inv.currentCostPerMg, 5)); // first vial
  assert.ok(close(inv.remainingMg, 20));
});

it("FIFO: fully depleted → values next dose at most-recent re-buy price", () => {
  const purchases = [
    P("a", "c", 10, 1, 50, "2026-01-01"),
    P("b", "c", 10, 1, 80, "2026-02-01"),
  ];
  const inv = compoundInventory("c", purchases, 20, 1); // all 20 mg gone
  assert.ok(close(inv.remainingMg, 0));
  assert.ok(close(inv.currentCostPerMg, 8)); // re-buy = newest
});

it("weighted average = total spend / total mg", () => {
  const purchases = [
    P("a", "c", 10, 1, 50, "2026-01-01"), // $5/mg
    P("b", "c", 10, 3, 240, "2026-02-01"), // 30 mg @ $8/mg
  ];
  const inv = compoundInventory("c", purchases, 0, 0.5);
  // (50+240) / (10+30) = 290/40 = 7.25 /mg
  assert.ok(close(inv.avgCostPerMg, 7.25));
  assert.ok(close(inv.avgCostPerDoseUsd, 7.25 * 0.5));
});

it("no active dose → dose-based fields are null, mg fields still computed", () => {
  const inv = compoundInventory("c", [P("a", "c", 10, 1, 50, "2026-01-01")], 4, null);
  assert.equal(inv.costOfNextDoseUsd, null);
  assert.equal(inv.remainingDoses, null);
  assert.ok(close(inv.remainingMg, 6));
  assert.ok(close(inv.avgCostPerMg, 5));
});

// ---- range filter + spend summary ----
it("filterByRange is inclusive on both ends", () => {
  const ps = [
    P("a", "c", 10, 1, 10, "2026-01-01"),
    P("b", "c", 10, 1, 10, "2026-02-15"),
    P("c", "c", 10, 1, 10, "2026-03-31"),
  ];
  assert.equal(filterByRange(ps, "2026-02-01", "2026-03-01").length, 1);
  assert.equal(filterByRange(ps, "2026-01-01", "2026-03-31").length, 3);
  assert.equal(filterByRange(ps, "2026-02-15", "2026-02-15").length, 1);
});

it("spendSummary totals, by-compound breakdown sorted desc, $/lb lost", () => {
  const ps = [
    P("a", "c1", 10, 1, 100, "2026-01-01"),
    P("b", "c2", 10, 1, 40, "2026-01-05"),
    P("c", "c1", 10, 1, 60, "2026-01-10"),
  ];
  const s = spendSummary(ps, 8); // lost 8 lb
  assert.ok(close(s.totalUsd, 200));
  assert.equal(s.byCompound[0].compoundId, "c1"); // 160 > 40
  assert.ok(close(s.byCompound[0].spendUsd, 160));
  assert.ok(close(s.byCompound[0].avgCostPerMg, 160 / 20));
  assert.ok(close(s.costPerLbLostUsd, 200 / 8)); // $25/lb
});

it("spendSummary: no weight loss → costPerLbLost null", () => {
  const s = spendSummary([P("a", "c", 10, 1, 50, "2026-01-01")], 0);
  assert.equal(s.costPerLbLostUsd, null);
  const s2 = spendSummary([P("a", "c", 10, 1, 50, "2026-01-01")], null);
  assert.equal(s2.costPerLbLostUsd, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
