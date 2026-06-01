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

import {
  shapeWeightLane,
  shapeFoodLanes,
  shapeDoseLane,
  shapeTrainingLane,
  shapeGoalMetricLanes,
  shapeLabsLane,
  shapeSpendLane,
  shapeActivePeptideLane,
  buildTimelineModel,
} from "../packages/shared/src/timeline/shapers.ts";

const scale = buildTimeScale("2026-05-01", "2026-05-31");

it("weight lane: line points normalized, summary shows first→last", () => {
  const lane = shapeWeightLane(
    [
      { logged_at: "2026-05-01", value_lb: 268 },
      { logged_at: "2026-05-31", value_lb: 254 },
    ],
    scale,
  );
  assert.equal(lane.kind, "line");
  assert.equal(lane.line.length, 2);
  assert.ok(close(lane.line[0].frac, 0));
  assert.ok(close(lane.line[1].frac, 1));
  // lower weight should sit higher (vFrac larger) is a render concern; here just domain:
  assert.equal(lane.min, 254);
  assert.equal(lane.max, 268);
  assert.match(lane.summary, /268/);
  assert.match(lane.summary, /254/);
});

it("weight lane readAt returns nearest-day value or null when empty", () => {
  const lane = shapeWeightLane([{ logged_at: "2026-05-10", value_lb: 260 }], scale);
  assert.match(lane.readAt("2026-05-10"), /260/);
  const empty = shapeWeightLane([], scale);
  assert.equal(empty.readAt("2026-05-10"), null);
});

it("food lanes: daily calorie + protein sums bucketed by day", () => {
  const [cal, protein] = shapeFoodLanes(
    [
      { logged_at: "2026-05-10T08:00:00", calories_kcal: 500, protein_g: 40 },
      { logged_at: "2026-05-10T13:00:00", calories_kcal: 700, protein_g: 50 },
    ],
    scale,
  );
  assert.equal(cal.key, "calories");
  assert.equal(protein.key, "protein");
  const day = cal.bars.find((b) => b.dateISO === "2026-05-10");
  assert.equal(day.v, 1200);
  const pday = protein.bars.find((b) => b.dateISO === "2026-05-10");
  assert.equal(pday.v, 90);
});

it("dose lane: one event per dose, tone by adherence", () => {
  const lane = shapeDoseLane(
    [
      { taken_at: "2026-05-05T09:00:00", adherence: "taken" },
      { taken_at: "2026-05-06T09:00:00", adherence: "missed" },
    ],
    scale,
  );
  assert.equal(lane.kind, "events");
  assert.equal(lane.events.length, 2);
  assert.equal(lane.events[0].tone, "good");
  assert.equal(lane.events[1].tone, "bad");
});

it("training lane: markers with duration, readAt lists the session", () => {
  const lane = shapeTrainingLane(
    [{ date: "2026-05-07", session_type: "lifting", duration_min: 45, perceived_exertion: 7 }],
    scale,
  );
  assert.equal(lane.kind, "markers");
  assert.equal(lane.events.length, 1);
  assert.match(lane.readAt("2026-05-07"), /lifting/);
});

it("goal-metric lanes: one lane per metric_key, labelled from catalog", () => {
  const lanes = shapeGoalMetricLanes(
    [
      { metric_key: "skin_quality", value: 6, unit: "rating", logged_at: "2026-05-02" },
      { metric_key: "skin_quality", value: 8, unit: "rating", logged_at: "2026-05-20" },
      { metric_key: "waist_cm", value: 102, unit: "cm", logged_at: "2026-05-02" },
    ],
    scale,
  );
  assert.equal(lanes.length, 2);
  const skin = lanes.find((l) => l.key === "goal:skin_quality");
  assert.equal(skin.label, "Skin quality");
  assert.equal(skin.line.length, 2);
});

it("labs lane: marker per draw day, readAt flags out-of-range for clinician", () => {
  const lane = shapeLabsLane(
    [
      { collected_on: "2026-05-04", marker: "Hemoglobin A1c", marker_key: "a1c", value: 7.2, unit: "%", ref_low: 4, ref_high: 5.6 },
      { collected_on: "2026-05-04", marker: "Glucose", marker_key: "glucose_fasting", value: 124, unit: "mg/dL", ref_low: 70, ref_high: 99 },
    ],
    scale,
  );
  assert.equal(lane.kind, "markers");
  assert.equal(lane.events.length, 1); // one marker for the single draw day
  const read = lane.readAt("2026-05-04");
  assert.match(read, /A1c/);
  assert.match(read, /clinician/i); // framed for discussion, never interpreted
});

it("spend lane: tick per purchase, summary = running total", () => {
  const lane = shapeSpendLane(
    [
      { purchased_on: "2026-05-03", price_usd: 200 },
      { purchased_on: "2026-05-18", price_usd: 235 },
    ],
    scale,
  );
  assert.equal(lane.kind, "events");
  assert.equal(lane.events.length, 2);
  assert.match(lane.summary, /435/);
});

it("active-peptide lane: one interval row per compound, clipped to range", () => {
  const lane = shapeActivePeptideLane(
    {
      phases: [
        {
          starts_on: "2026-04-15",
          ends_on: null,
          items: [
            { compound: { name: "Retatrutide" }, starts_on: "2026-04-15", ends_on: null },
            { compound: { name: "AOD-9604" }, starts_on: "2026-05-10", ends_on: "2026-05-25" },
          ],
        },
      ],
    },
    scale,
  );
  assert.equal(lane.kind, "intervals");
  assert.equal(lane.rowCount, 2);
  // Retatrutide started before the range → clipped to 0
  const reta = lane.intervals.find((s) => s.label === "Retatrutide");
  assert.equal(reta.x0, 0);
  assert.equal(reta.x1, 1); // ongoing → range end
  const aod = lane.intervals.find((s) => s.label === "AOD-9604");
  assert.ok(aod.x0 > 0 && aod.x1 < 1);
});

it("buildTimelineModel returns ticks + only non-empty lanes", () => {
  const model = buildTimelineModel({
    range: { startISO: "2026-05-01", endISO: "2026-05-31" },
    weights: [{ logged_at: "2026-05-01", value_lb: 268 }],
    foods: [],
    doses: [],
    workouts: [],
    goalMetrics: [],
    labs: [],
    purchases: [],
    regimen: null,
  });
  assert.ok(model.ticks.length >= 2);
  assert.ok(model.lanes.some((l) => l.key === "weight"));
  // empty streams produce no lane
  assert.ok(!model.lanes.some((l) => l.key === "calories"));
});

// ---- edge cases ----
it("weight lane: single point → vFrac 0.5 (span-0 fallback)", () => {
  const lane = shapeWeightLane([{ logged_at: "2026-05-10", value_lb: 260 }], scale);
  assert.equal(lane.line.length, 1);
  assert.ok(close(lane.line[0].vFrac, 0.5));
});

it("weight lane: non-finite value is dropped; min/max/summary stay finite", () => {
  const lane = shapeWeightLane(
    [
      { logged_at: "2026-05-01", value_lb: 268 },
      { logged_at: "2026-05-15", value_lb: Number.NaN },
      { logged_at: "2026-05-31", value_lb: 254 },
    ],
    scale,
  );
  assert.ok(Number.isFinite(lane.min));
  assert.ok(Number.isFinite(lane.max));
  assert.equal(lane.min, 254);
  assert.equal(lane.max, 268);
  assert.ok(!/NaN/.test(lane.summary));
  assert.equal(lane.line.length, 2); // bad row dropped
});

it("goal-metric lane: non-finite value is dropped; domain stays finite", () => {
  const lanes = shapeGoalMetricLanes(
    [
      { metric_key: "waist_cm", value: 102, unit: "cm", logged_at: "2026-05-02" },
      { metric_key: "waist_cm", value: Number.NaN, unit: "cm", logged_at: "2026-05-12" },
      { metric_key: "waist_cm", value: 98, unit: "cm", logged_at: "2026-05-22" },
    ],
    scale,
  );
  assert.equal(lanes.length, 1);
  const waist = lanes[0];
  assert.ok(Number.isFinite(waist.min) && Number.isFinite(waist.max));
  assert.equal(waist.line.length, 2);
  assert.ok(!/NaN/.test(waist.summary));
});

it("labs lane: unknown range (no report + no catalog) is NOT flagged", () => {
  const lane = shapeLabsLane(
    [
      {
        collected_on: "2026-05-04",
        marker: "Mystery Marker",
        marker_key: "made_up_marker",
        value: 42,
        unit: "x",
        ref_low: null,
        ref_high: null,
      },
    ],
    scale,
  );
  assert.equal(lane.events.length, 1);
  assert.equal(lane.events[0].tone, "neutral");
  const read = lane.readAt("2026-05-04");
  assert.match(read, /Mystery Marker/);
  assert.ok(!/clinician/i.test(read)); // nothing to flag → no clinician phrase
});

it("active-peptide lane: same compound across two phases → union interval", () => {
  const lane = shapeActivePeptideLane(
    {
      phases: [
        {
          starts_on: "2026-05-02",
          ends_on: "2026-05-10",
          items: [{ compound: { name: "MOTS-C" }, starts_on: "2026-05-02", ends_on: "2026-05-10" }],
        },
        {
          starts_on: "2026-05-18",
          ends_on: "2026-05-26",
          items: [{ compound: { name: "MOTS-C" }, starts_on: "2026-05-18", ends_on: "2026-05-26" }],
        },
      ],
    },
    scale,
  );
  assert.equal(lane.rowCount, 1); // one compound, one row
  const seg = lane.intervals.find((s) => s.label === "MOTS-C");
  // union spans min start (May 2) → max end (May 26)
  assert.ok(close(seg.x0, scale.frac(+new Date("2026-05-02T00:00:00"))));
  assert.ok(close(seg.x1, scale.frac(+new Date("2026-05-26T00:00:00"))));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
