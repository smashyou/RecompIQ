#!/usr/bin/env node
// Test harness for the energy / calorie-target engine. Runs via `pnpm test:energy`.
import assert from "node:assert/strict";
import {
  leanMassFromBodyFat,
  bmrKcal,
  palFromSteps,
  ACTIVITY_FACTORS,
  cappedLossRate,
  calorieTarget,
  macroTargets,
  KCAL_PER_LB_FAT,
  MAX_LOSS_LB_PER_WEEK,
} from "../packages/shared/src/goals/energy.ts";

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n     ${e.message}`); failed++; }
}
const close = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// John's actual starting profile, used as the worked example throughout.
const JOHN = { weightLb: 265, heightIn: 70.5, ageYears: 42, sex: "male" };

// ---- BMR ----

it("Mifflin-St Jeor matches a hand-calculated BMR", () => {
  // 265 lb = 120.20 kg, 70.5 in = 179.07 cm
  // 10(120.20) + 6.25(179.07) - 5(42) + 5 = 2116
  const r = bmrKcal(JOHN);
  assert.equal(r.basis, "mifflin-st-jeor");
  assert.ok(close(r.kcal, 2116, 2), `expected ~2116, got ${r.kcal}`);
});

it("Mifflin-St Jeor applies the female constant", () => {
  const male = bmrKcal({ ...JOHN, sex: "male" }).kcal;
  const female = bmrKcal({ ...JOHN, sex: "female" }).kcal;
  assert.ok(close(male - female, 166, 1), "male/female constants differ by 166");
});

it("Katch-McArdle is preferred when lean mass is known, and needs no sex", () => {
  // 265 lb @ 35% BF → 172.25 lb LBM = 78.13 kg → 370 + 21.6(78.13) = 2058
  const r = bmrKcal({ weightLb: 265, bodyFatPct: 35, sex: "prefer_not_to_say" });
  assert.equal(r.basis, "katch-mcardle");
  assert.ok(close(r.kcal, 2058, 2), `expected ~2058, got ${r.kcal}`);
});

it("leanMassFromBodyFat is the inverse of body-fat percentage", () => {
  assert.ok(close(leanMassFromBodyFat(265, 35), 172.25, 0.01));
  assert.equal(leanMassFromBodyFat(265, null), null);
  assert.equal(leanMassFromBodyFat(265, 0), null);   // 0% BF is not credible
  assert.equal(leanMassFromBodyFat(265, 95), null);  // outside the sane band
});

it("BMR returns null rather than guessing when inputs are missing", () => {
  // No lean mass AND sex unknown → Mifflin has no sex constant to apply.
  assert.equal(bmrKcal({ weightLb: 265, heightIn: 70.5, ageYears: 42, sex: "prefer_not_to_say" }), null);
  assert.equal(bmrKcal({ weightLb: 265, ageYears: 42, sex: "male" }), null);      // no height
  assert.equal(bmrKcal({ weightLb: 265, heightIn: 70.5, sex: "male" }), null);    // no age
  assert.equal(bmrKcal({ weightLb: 0, heightIn: 70.5, ageYears: 42, sex: "male" }), null);
});

// ---- activity ----

it("palFromSteps maps measured steps to an activity factor", () => {
  assert.equal(palFromSteps(3000).factor, ACTIVITY_FACTORS.sedentary);
  assert.equal(palFromSteps(6000).factor, ACTIVITY_FACTORS.light);
  assert.equal(palFromSteps(10000).factor, ACTIVITY_FACTORS.moderate);
  assert.equal(palFromSteps(15000).factor, ACTIVITY_FACTORS.very);
});

it("palFromSteps refuses to infer activity from absent data", () => {
  // No steps logged is NOT evidence of being sedentary — the same
  // unlogged-means-invisible trap the adherence denominator had.
  assert.equal(palFromSteps(null), null);
  assert.equal(palFromSteps(undefined), null);
});

// ---- loss rate safety ----

it("cappedLossRate never exceeds the rate the alert engine flags as rapid", () => {
  // rapid_weight_loss warns at 2 lb/wk, so targeting 2.7 would ask the user to
  // do the very thing the app would then warn them about.
  const r = cappedLossRate(265, 2.7);
  assert.ok(r.lbPerWeek <= MAX_LOSS_LB_PER_WEEK);
  assert.equal(r.capped, true);
  assert.match(r.reason, /rapid|2 lb/i);
});

it("cappedLossRate also caps at 1% of bodyweight per week for lighter people", () => {
  // 150 lb → 1% = 1.5 lb/wk, which binds before the flat 2 lb/wk cap.
  const r = cappedLossRate(150, 2);
  assert.ok(close(r.lbPerWeek, 1.5, 0.01));
  assert.equal(r.capped, true);
});

it("cappedLossRate leaves a reasonable requested rate alone", () => {
  const r = cappedLossRate(265, 1.5);
  assert.ok(close(r.lbPerWeek, 1.5, 0.01));
  assert.equal(r.capped, false);
});

// ---- calorie target ----

const GOAL = { currentWeightLb: 265, goalWeightLb: 195, timelineWeeks: 26 };

it("calorieTarget subtracts a deficit from TDEE and reports its working", () => {
  const t = calorieTarget({ ...JOHN, ...GOAL, avgStepsPerDay: 10000 });
  assert.ok(t, "expected a target");
  assert.ok(close(t.bmrKcal, 2116, 2));
  assert.ok(close(t.tdeeKcal, 2116 * ACTIVITY_FACTORS.moderate, 3));
  // 70 lb over 26 wk = 2.69 lb/wk → capped to 2.0 → 1000 kcal/day deficit
  assert.equal(t.rateCapped, true);
  assert.ok(close(t.lbPerWeek, 2, 0.01));
  assert.ok(close(t.deficitKcal, 1000, 2));
  assert.ok(close(t.targetKcal, 2116 * ACTIVITY_FACTORS.moderate - 1000, 4));
});

it("SAFETY: the target is never allowed below BMR", () => {
  // Sedentary: TDEE 2539 - 1000 deficit = 1539, which is under the 2116 BMR.
  const t = calorieTarget({ ...JOHN, ...GOAL, avgStepsPerDay: 3000 });
  assert.equal(t.floored, true);
  assert.ok(t.targetKcal >= t.bmrKcal, "target must not sit below BMR");
  assert.ok(close(t.targetKcal, t.bmrKcal, 1));
});

it("a floored target reports the rate that is actually achievable", () => {
  // When the floor binds, the requested timeline is not reachable at this
  // activity level. Saying so is the useful output — silently returning a
  // too-low number would be the harmful one.
  const t = calorieTarget({ ...JOHN, ...GOAL, avgStepsPerDay: 3000 });
  assert.ok(t.achievableLbPerWeek < t.lbPerWeek);
  assert.ok(t.achievableLbPerWeek > 0);
  // TDEE 2539 - BMR 2116 = 423 kcal/day → 423*7/3500 = 0.85 lb/wk
  assert.ok(close(t.achievableLbPerWeek, 0.85, 0.05), `got ${t.achievableLbPerWeek}`);
});

it("calorieTarget returns a RANGE, not a single fake-precise number", () => {
  const t = calorieTarget({ ...JOHN, ...GOAL, avgStepsPerDay: 10000 });
  assert.ok(t.lowKcal < t.targetKcal && t.targetKcal < t.highKcal);
  assert.ok(t.highKcal - t.lowKcal >= 100, "band should be meaningful");
});

it("calorieTarget returns null when BMR cannot be established", () => {
  assert.equal(calorieTarget({ weightLb: 265, sex: "prefer_not_to_say", ...GOAL }), null);
});

it("calorieTarget without step data still works but says the basis is assumed", () => {
  const t = calorieTarget({ ...JOHN, ...GOAL });
  assert.ok(t);
  assert.equal(t.activityMeasured, false);
  assert.equal(t.activityLabel, "sedentary");
});

it("maintenance goal (no deficit) targets TDEE itself", () => {
  const t = calorieTarget({ ...JOHN, currentWeightLb: 200, goalWeightLb: 200, timelineWeeks: 26, avgStepsPerDay: 10000 });
  assert.ok(close(t.deficitKcal, 0, 1));
  assert.ok(close(t.targetKcal, t.tdeeKcal, 1));
});

it("a weight-GAIN goal produces a surplus, not a negative deficit", () => {
  const t = calorieTarget({ ...JOHN, currentWeightLb: 180, goalWeightLb: 195, timelineWeeks: 26, avgStepsPerDay: 10000 });
  assert.ok(t.targetKcal > t.tdeeKcal, "gain goal should eat above maintenance");
  assert.equal(t.floored, false);
});

// ---- macros ----

it("macroTargets splits the remainder after protein into fat and carbs", () => {
  const m = macroTargets(2400, { proteinGMin: 160, proteinGMax: 190 });
  // fat 20-35% of energy → 2400*0.20/9 = 53g … 2400*0.35/9 = 93g
  assert.ok(close(m.fatGMin, 53, 1));
  assert.ok(close(m.fatGMax, 93, 1));
  // carbs are the remainder after the protein midpoint and the fat band
  assert.ok(m.carbGMin > 0 && m.carbGMax > m.carbGMin);
});

it("macroTargets never returns negative carbs when protein and fat are high", () => {
  const m = macroTargets(1200, { proteinGMin: 190, proteinGMax: 190 });
  assert.ok(m.carbGMin >= 0, "carbs floor at zero rather than going negative");
  assert.ok(m.carbGMax >= 0);
});

it("KCAL_PER_LB_FAT is the documented approximation", () => {
  assert.equal(KCAL_PER_LB_FAT, 3500);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
