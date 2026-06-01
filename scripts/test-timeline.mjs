#!/usr/bin/env node
// Test harness for the unified-timeline pure model. Runs via `pnpm test:timeline`.

import assert from "node:assert/strict";
import { buildTimeScale } from "../packages/shared/src/timeline/scale.ts";

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

// ---- time scale ----
it("frac maps range start→0, end→1, midpoint→0.5", () => {
  const s = buildTimeScale("2026-05-01", "2026-05-31");
  assert.ok(close(s.frac(+new Date("2026-05-01T00:00:00")), 0));
  assert.ok(close(s.frac(+new Date("2026-05-31T00:00:00")), 1));
  assert.ok(close(s.frac(+new Date("2026-05-16T00:00:00")), 0.5));
});

it("frac clamps outside the range to [0,1]", () => {
  const s = buildTimeScale("2026-05-01", "2026-05-31");
  assert.equal(s.frac(+new Date("2026-04-01")), 0);
  assert.equal(s.frac(+new Date("2026-07-01")), 1);
});

it("ticks(4) returns 4 evenly spaced, monotonic fracs in [0,1]", () => {
  const s = buildTimeScale("2026-05-01", "2026-05-31");
  const t = s.ticks(4);
  assert.equal(t.length, 4);
  for (let i = 1; i < t.length; i++) assert.ok(t[i].frac > t[i - 1].frac);
  assert.ok(t[0].frac >= 0 && t[t.length - 1].frac <= 1);
});

it("zero-width range does not divide by zero", () => {
  const s = buildTimeScale("2026-05-01", "2026-05-01");
  assert.ok(Number.isFinite(s.frac(+new Date("2026-05-01"))));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
