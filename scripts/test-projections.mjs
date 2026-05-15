#!/usr/bin/env node
// Tiny test harness for the projections engine. Runs via `pnpm test:projections`.
// We avoid Vitest here so the engine stays runnable from a bare Node install.

import assert from "node:assert/strict";
import {
  buildProjection,
  deriveRates,
  etaForRate,
  currentTrendLbsPerWeek,
  sevenDayMA,
  adherenceLabel,
} from "../packages/projections/src/index.ts";

// Allow .ts import via the experimental loader if available; otherwise
// instruct user. Node 22+ supports TS via --experimental-strip-types.
// For Node 20, this script is invoked through tsx (added as devDep).

let passed = 0;
let failed = 0;
function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("deriveRates");
it("computes target rate = (start - mid) / weeks", () => {
  const r = deriveRates({ startWeightLb: 265, targetMidLb: 195, timelineWeeks: 26 });
  // (265 - 195) / 26 = 2.6923... → rounds to 2.69
  assert.equal(r.target, 2.69);
});
it("conservative is 60% of target, aggressive is 115%", () => {
  const r = deriveRates({ startWeightLb: 265, targetMidLb: 195, timelineWeeks: 26 });
  assert.equal(r.conservative, 1.62);
  assert.equal(r.aggressive, 3.1);
});
it("clamps rates to [0.25, 3.5]", () => {
  const tooHigh = deriveRates({ startWeightLb: 400, targetMidLb: 150, timelineWeeks: 5 });
  assert.equal(tooHigh.aggressive, 3.5);
  const tooLow = deriveRates({ startWeightLb: 200, targetMidLb: 199, timelineWeeks: 100 });
  assert.equal(tooLow.conservative, 0.25);
});

console.log("\netaForRate");
it("returns null at zero rate", () => {
  assert.equal(etaForRate(200, 180, 0), null);
});
it("returns 0 if already at or below target", () => {
  assert.equal(etaForRate(180, 200, 2), 0);
});
it("ceils to whole weeks", () => {
  // 20 lb / 3 lb/wk = 6.67 → 7 weeks
  assert.equal(etaForRate(200, 180, 3), 7);
});

console.log("\ncurrentTrendLbsPerWeek");
it("returns null if fewer than 2 points", () => {
  assert.equal(currentTrendLbsPerWeek([{ logged_at: "2026-05-01", value_lb: 200 }]), null);
});
it("computes weekly trend over a 2-week span", () => {
  const series = [
    { logged_at: "2026-05-01", value_lb: 200 },
    { logged_at: "2026-05-15", value_lb: 196 }, // -4 lb over 14 days = 2 lb/week
  ];
  assert.equal(currentTrendLbsPerWeek(series), 2);
});

console.log("\nsevenDayMA");
it("smooths a small series", () => {
  const series = [
    { logged_at: "2026-05-01", value_lb: 200 },
    { logged_at: "2026-05-02", value_lb: 198 },
    { logged_at: "2026-05-03", value_lb: 202 },
  ];
  const ma = sevenDayMA(series);
  assert.equal(ma.length, 3);
  // Last MA = avg(200, 198, 202) = 200.0
  assert.equal(ma[ma.length - 1].value_lb, 200);
});

console.log("\nadherenceLabel");
it("flags 'on-target' when at target rate", () => {
  const rates = { conservative: 1.5, target: 2.5, aggressive: 3 };
  assert.equal(adherenceLabel(2.6, rates), "on-target");
});
it("flags 'ahead' beyond aggressive", () => {
  assert.equal(adherenceLabel(3.5, { conservative: 1.5, target: 2.5, aggressive: 3 }), "ahead");
});
it("flags 'stalled' at zero or negative trend", () => {
  assert.equal(adherenceLabel(0, { conservative: 1, target: 2, aggressive: 3 }), "stalled");
  assert.equal(adherenceLabel(-1, { conservative: 1, target: 2, aggressive: 3 }), "stalled");
});

console.log("\nbuildProjection (Demo User A)");
it("Demo user shape: 265 → 195 (mid of 190-200), 26 weeks", () => {
  const weights = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return {
      logged_at: d.toISOString(),
      value_lb: 265 - i * 0.3,
    };
  });
  const result = buildProjection({
    weights,
    startWeightLb: 265,
    goalWeightLbMin: 190,
    goalWeightLbMax: 200,
    timelineWeeks: 26,
  });
  assert.ok(result);
  assert.equal(result.targetMidLb, 195);
  assert.equal(result.series.target.lbsPerWeek, 2.69);
  // Current = 265 - 13*0.3 = 261.1, gap to 195 = 66.1 lb
  // At target 2.69/wk: ceil(66.1 / 2.69) = ceil(24.57) = 25 weeks
  assert.equal(result.series.target.etaWeeks, 25);
  assert.equal(result.series.target.points.length, 35); // 0..34 = 26 + 8 buffer
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
