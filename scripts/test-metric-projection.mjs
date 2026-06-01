#!/usr/bin/env node
// Tests for the generalized metric projector. Runs via `pnpm test:metric-projection`.

import assert from "node:assert/strict";
import {
  observedPerWeek,
  metricMA,
  buildMetricProjection,
} from "../packages/projections/src/metric.ts";

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
const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

it("observedPerWeek: rising series is positive", () => {
  const s = [{ date: day(14), value: 5 }, { date: day(0), value: 8 }]; // +3 over 14d
  assert.ok(close(observedPerWeek(s), 1.5)); // 3/14*7
});

it("observedPerWeek: <2 points → null", () => {
  assert.equal(observedPerWeek([{ date: day(0), value: 5 }]), null);
});

it("metricMA smooths", () => {
  const ma = metricMA([{ date: day(2), value: 4 }, { date: day(1), value: 6 }, { date: day(0), value: 8 }]);
  assert.equal(ma.length, 3);
  assert.ok(ma[ma.length - 1].value > 4 && ma[ma.length - 1].value <= 8);
});

it("no expected rate → trend only, no projection", () => {
  const r = buildMetricProjection([{ date: day(7), value: 5 }, { date: day(0), value: 6 }], {
    higherIsBetter: true,
    expectedRatePerWeek: null,
  });
  assert.equal(r.projection, null);
  assert.equal(r.illustrative, false);
  assert.equal(r.current, 6);
});

it("higherIsBetter projection rises; multipliers ordered", () => {
  const r = buildMetricProjection([{ date: day(7), value: 5 }, { date: day(0), value: 6 }], {
    higherIsBetter: true,
    expectedRatePerWeek: 0.5,
    horizonWeeks: 4,
    clampMin: 1,
    clampMax: 10,
  });
  assert.ok(r.projection);
  assert.ok(r.illustrative);
  // week 4: target = 6 + 0.5*4 = 8
  assert.ok(close(r.projection.target.points[4].value, 8));
  // aggressive > target > conservative at week 4
  assert.ok(r.projection.aggressive.points[4].value > r.projection.target.points[4].value);
  assert.ok(r.projection.target.points[4].value > r.projection.conservative.points[4].value);
});

it("lowerIsBetter projection falls (e.g. waist)", () => {
  const r = buildMetricProjection([{ date: day(0), value: 110 }], {
    higherIsBetter: false,
    expectedRatePerWeek: 1, // 1 cm/wk improvement
    horizonWeeks: 4,
  });
  assert.ok(r.projection.target.points[4].value < 110); // went down
  assert.ok(close(r.projection.target.points[4].value, 106));
});

it("clamp keeps ratings within bounds", () => {
  const r = buildMetricProjection([{ date: day(0), value: 9 }], {
    higherIsBetter: true,
    expectedRatePerWeek: 1,
    horizonWeeks: 8,
    clampMin: 1,
    clampMax: 10,
  });
  assert.ok(r.projection.target.points[8].value <= 10);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
