# Unified Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/timeline` screen (web + mobile) that renders every tracked stream — doses, active peptides, food, training, weight, goal metrics, labs, spend — as synchronized horizontal lanes over a user-chosen date range, with a scrub crosshair that reads every lane on one day.

**Architecture:** A pure, normalized **lane model** in `@peptide/shared/timeline` does all scaling/placement math (resolution-independent fractions 0..1), unit-tested via `pnpm test:timeline`. Platform query layers fetch raw rows; thin SVG renderers (web `<svg>`, mobile `react-native-svg`) draw the model. No new DB tables — every source is already RLS'd.

**Tech Stack:** TypeScript, Next.js 15 App Router (SSR + client), `react-native-svg` + `react-native-gesture-handler` (mobile), Supabase JS, the existing responsive primitives (`<Page>/<PageHeader>/<AutoGrid>` web, `Content` + `useResponsive()` mobile).

**Spec:** `docs/superpowers/specs/2026-06-01-unified-timeline-design.md`

**Conventions carried in:**
- Commit author `John Ryu <johnminryu@gmail.com>`, NO Claude co-author trailer, `--no-verify`. Run `git status` AFTER every `git add`.
- Gates (local `next build` is broken): `pnpm turbo run typecheck` (expect 16/16) · `pnpm test:timeline` · `cd apps/mobile && npx expo export -p ios` · Vercel deploy READY · Playwright overflow at 390px (`/tmp/ofcheck`).
- Read-only feature: emits no doses/projections. Labs keep status-for-clinician flags, never interpreted. Run `safety-reviewer` on labs/dose render paths before the final commit.

---

## File Structure

**Shared model (new subpath `@peptide/shared/timeline`):**
- Create `packages/shared/src/timeline/scale.ts` — `buildTimeScale` (date range → fractional x + axis ticks).
- Create `packages/shared/src/timeline/types.ts` — `TimelineLane`, point/segment/event types, `LaneTone`, `LaneKind`.
- Create `packages/shared/src/timeline/shapers.ts` — one pure shaper per stream + `buildTimelineModel`.
- Create `packages/shared/src/timeline/index.ts` — barrel for the subpath.
- Modify `packages/shared/package.json` — add `"./timeline"` export.
- Create `scripts/test-timeline.mjs` — the harness.
- Modify root `package.json` — add `"test:timeline"` script.

**Web:**
- Create `apps/web/lib/queries/timeline.ts` — `loadTimeline(userId, range)` (one `Promise.all`, returns raw rows).
- Create `apps/web/components/timeline/timeline-lanes.tsx` — SVG lane renderer + crosshair (client).
- Create `apps/web/app/(app)/timeline/page.tsx` — SSR shell.
- Create `apps/web/app/(app)/timeline/timeline-client.tsx` — range state, scrub, readout, visibility toggles.
- Modify `apps/web/components/nav.tsx` — add the Timeline nav item.

**Mobile:**
- Create `apps/mobile/lib/timeline.ts` — `loadTimeline(userId, range)` via supabase-js.
- Create `apps/mobile/app/(tabs)/more/timeline.tsx` — screen with SVG lanes + pan scrub.
- Modify `apps/mobile/app/(tabs)/more/index.tsx` — add the Timeline row.

**Demo:**
- Modify `scripts/seed-demo.mjs` — ensure every lane spans a readable window (verify, extend if thin).

---

## Task 1: Shared model — types + time scale (TDD)

**Files:**
- Create: `packages/shared/src/timeline/types.ts`
- Create: `packages/shared/src/timeline/scale.ts`
- Create: `packages/shared/src/timeline/index.ts`
- Modify: `packages/shared/package.json`
- Create: `scripts/test-timeline.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Write the types file**

Create `packages/shared/src/timeline/types.ts`:

```ts
// Pure, normalized lane model for the unified timeline (PRD §5.6/§8.7).
// All geometry is resolution-independent: x is a fraction 0..1 across the plot,
// vFrac is a fraction 0..1 within the lane (0 = lane min, 1 = lane max). Each
// platform multiplies by its own pixel/viewBox dimensions. No React, no DB.

export type LaneKind = "line" | "bars" | "events" | "markers" | "intervals";
export type LaneTone = "neutral" | "good" | "warn" | "bad" | "accent";

export interface LinePoint {
  frac: number; // x position 0..1
  vFrac: number; // y position 0..1 within lane (already normalized)
  v: number; // raw value
  dateISO: string;
}

export interface BarPoint {
  frac: number;
  vFrac: number;
  v: number;
  dateISO: string;
}

export interface EventDot {
  frac: number;
  dateISO: string;
  label: string;
  tone: LaneTone;
}

export interface IntervalSeg {
  x0: number; // 0..1, clipped to range
  x1: number; // 0..1, clipped to range
  row: number; // gantt row index
  label: string;
  tone: LaneTone;
}

export interface TimelineLane {
  key: string; // 'weight', 'doses', 'goal:skin_quality', …
  label: string;
  kind: LaneKind;
  summary: string; // "268→254 lb", "5× · 142 min", "$435"
  unit: string | null;
  min: number | null; // lane value domain (for axis label)
  max: number | null;
  line?: LinePoint[];
  bars?: BarPoint[];
  events?: EventDot[];
  intervals?: IntervalSeg[];
  rowCount?: number; // number of gantt rows (intervals only)
  /** Scrub readout for a given day; null = no data that day. */
  readAt(dateISO: string): string | null;
}

export interface TimelineModel {
  startISO: string;
  endISO: string;
  ticks: { frac: number; label: string }[];
  lanes: TimelineLane[];
}
```

- [ ] **Step 2: Write the failing test for the time scale**

Create `scripts/test-timeline.mjs`:

```js
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
```

- [ ] **Step 3: Wire the test script**

In root `package.json`, add after the `test:metric-projection` line (line 34):

```json
    "test:metric-projection": "tsx scripts/test-metric-projection.mjs",
    "test:timeline": "tsx scripts/test-timeline.mjs"
```

(Add a comma to the prior line.)

- [ ] **Step 4: Run the test, verify it fails**

Run: `pnpm test:timeline`
Expected: FAIL — `Cannot find module .../scale.ts` (not yet created).

- [ ] **Step 5: Implement the time scale**

Create `packages/shared/src/timeline/scale.ts`:

```ts
import type { TimelineModel } from "./types";

export interface TimeScale {
  startMs: number;
  endMs: number;
  /** Fraction 0..1 across the plot for a date (ms); clamps outside range. */
  frac(dateMs: number): number;
  /** `count` evenly spaced tick dates with short labels. */
  ticks(count: number): TimelineModel["ticks"];
}

const DAY = 86_400_000;

function toMs(iso: string): number {
  return +new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
}

export function buildTimeScale(startISO: string, endISO: string): TimeScale {
  const startMs = toMs(startISO);
  const endMs = Math.max(startMs, toMs(endISO));
  const span = Math.max(1, endMs - startMs);
  const frac = (dateMs: number) => {
    const f = (dateMs - startMs) / span;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  };
  const ticks = (count: number) => {
    const n = Math.max(2, count);
    const out: TimelineModel["ticks"] = [];
    for (let i = 0; i < n; i++) {
      const ms = startMs + (span * i) / (n - 1);
      out.push({
        frac: i / (n - 1),
        label: new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }
    return out;
  };
  return { startMs, endMs, frac, ticks };
}

export { toMs, DAY };
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `pnpm test:timeline`
Expected: `4 passed, 0 failed`.

- [ ] **Step 7: Add the subpath export + barrel**

Create `packages/shared/src/timeline/index.ts`:

```ts
export * from "./types";
export * from "./scale";
export * from "./shapers";
```

In `packages/shared/package.json` `exports`, add after `"./labs/shape"`:

```json
    "./labs/shape": "./src/labs/shape.ts",
    "./timeline": "./src/timeline/index.ts"
```

> Note: `./shapers` does not exist yet — Task 2 creates it. Until then the barrel will not typecheck; that's expected and resolved in Task 2. Do NOT run a full typecheck between Task 1 and Task 2.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/timeline/types.ts packages/shared/src/timeline/scale.ts packages/shared/src/timeline/index.ts packages/shared/package.json scripts/test-timeline.mjs package.json
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): pure time-scale + lane types + test harness" --no-verify
```

---

## Task 2: Shared model — stream shapers + buildTimelineModel (TDD)

**Files:**
- Create: `packages/shared/src/timeline/shapers.ts`
- Modify: `scripts/test-timeline.mjs`

Each shaper takes already-fetched raw rows + a `TimeScale` and returns a `TimelineLane`. Fetching stays in the platform query layer. Raw row shapes mirror the existing loaders (`weights`, `peptide_doses`, `food_logs`, `workouts`, `goal_metrics`, `lab_results`, `peptide_purchases`, and the shaped `ActiveRegimenView`).

- [ ] **Step 1: Write failing tests for the shapers**

Append to `scripts/test-timeline.mjs` (before the final `console.log`):

```js
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
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test:timeline`
Expected: FAIL — `Cannot find module .../shapers.ts`.

- [ ] **Step 3: Implement the shapers**

Create `packages/shared/src/timeline/shapers.ts`:

```ts
import { METRIC_BY_KEY } from "../goals/metrics";
import { effectiveRange, rangeStatus } from "../labs/catalog";
import { toMs, type TimeScale } from "./scale";
import type {
  BarPoint,
  EventDot,
  IntervalSeg,
  LaneTone,
  LinePoint,
  TimelineLane,
  TimelineModel,
} from "./types";

// ---- raw row shapes (mirror the platform loaders) ----
export interface WeightRow { logged_at: string; value_lb: number }
export interface FoodRow { logged_at: string; calories_kcal: number; protein_g: number }
export interface DoseRow { taken_at: string; adherence: string }
export interface WorkoutRow {
  date: string;
  session_type: string;
  duration_min: number | null;
  perceived_exertion: number | null;
}
export interface GoalMetricRow { metric_key: string; value: number; unit: string | null; logged_at: string }
export interface PurchaseRow { purchased_on: string; price_usd: number }
export interface LabRow {
  collected_on: string;
  marker: string;
  marker_key: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
}
export interface RegimenItemLike {
  compound: { name: string } | null;
  starts_on: string | null;
  ends_on: string | null;
}
export interface RegimenPhaseLike {
  starts_on: string | null;
  ends_on: string | null;
  items: RegimenItemLike[];
}
export interface RegimenLike { phases: RegimenPhaseLike[] }

const dayOf = (iso: string) => iso.slice(0, 10);
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

// y-normalization: 0 = domain min, 1 = domain max. Renderers invert for screen y.
function vFracOf(v: number, min: number, max: number): number {
  const span = max - min;
  return span <= 0 ? 0.5 : (v - min) / span;
}

function nearestByDay<T extends { dateISO: string }>(items: T[], dateISO: string): T | null {
  const target = +new Date(`${dateISO}T00:00:00`);
  let best: T | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    const d = Math.abs(+new Date(`${it.dateISO.slice(0, 10)}T00:00:00`) - target);
    if (d < bestDist) {
      bestDist = d;
      best = it;
    }
  }
  // only "read" within ~1.5 days so the crosshair doesn't claim distant data
  return best && bestDist <= 1.5 * 86_400_000 ? best : null;
}

export function shapeWeightLane(rows: WeightRow[], scale: TimeScale): TimelineLane {
  const sorted = [...rows].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const vals = sorted.map((r) => Number(r.value_lb));
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const line: LinePoint[] = sorted.map((r) => ({
    frac: scale.frac(toMs(r.logged_at)),
    v: Number(r.value_lb),
    vFrac: min !== null && max !== null ? vFracOf(Number(r.value_lb), min, max) : 0.5,
    dateISO: r.logged_at,
  }));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    key: "weight",
    label: "Weight",
    kind: "line",
    unit: "lb",
    min,
    max,
    line,
    summary: first && last ? `${num(Number(first.value_lb), 1)}→${num(Number(last.value_lb), 1)} lb` : "—",
    readAt: (d) => {
      const p = nearestByDay(line, d);
      return p ? `${num(p.v, 1)} lb` : null;
    },
  };
}

export function shapeFoodLanes(rows: FoodRow[], scale: TimeScale): [TimelineLane, TimelineLane] {
  const calByDay = new Map<string, number>();
  const proByDay = new Map<string, number>();
  for (const r of rows) {
    const day = dayOf(r.logged_at);
    calByDay.set(day, (calByDay.get(day) ?? 0) + Number(r.calories_kcal));
    proByDay.set(day, (proByDay.get(day) ?? 0) + Number(r.protein_g));
  }
  const toBars = (m: Map<string, number>): { bars: BarPoint[]; min: number | null; max: number | null } => {
    const days = [...m.keys()].sort();
    const vals = days.map((d) => m.get(d)!);
    const max = vals.length ? Math.max(...vals) : null;
    const bars = days.map((d) => ({
      frac: scale.frac(toMs(d)),
      v: m.get(d)!,
      vFrac: max && max > 0 ? m.get(d)! / max : 0,
      dateISO: d,
    }));
    return { bars, min: 0, max };
  };
  const cal = toBars(calByDay);
  const pro = toBars(proByDay);
  const avg = (m: Map<string, number>) =>
    m.size ? Math.round([...m.values()].reduce((a, b) => a + b, 0) / m.size) : 0;
  const calLane: TimelineLane = {
    key: "calories",
    label: "Calories",
    kind: "bars",
    unit: "kcal",
    min: cal.min,
    max: cal.max,
    bars: cal.bars,
    summary: calByDay.size ? `~${num(avg(calByDay))} kcal/day` : "—",
    readAt: (d) => (calByDay.has(d) ? `${num(calByDay.get(d)!)} kcal` : null),
  };
  const proLane: TimelineLane = {
    key: "protein",
    label: "Protein",
    kind: "bars",
    unit: "g",
    min: pro.min,
    max: pro.max,
    bars: pro.bars,
    summary: proByDay.size ? `~${num(avg(proByDay))} g/day` : "—",
    readAt: (d) => (proByDay.has(d) ? `${num(proByDay.get(d)!)} g` : null),
  };
  return [calLane, proLane];
}

const ADHERENCE_TONE: Record<string, LaneTone> = {
  taken: "good",
  partial: "warn",
  missed: "bad",
  skipped: "neutral",
};

export function shapeDoseLane(rows: DoseRow[], scale: TimeScale): TimelineLane {
  const events: EventDot[] = rows.map((r) => ({
    frac: scale.frac(toMs(r.taken_at)),
    dateISO: r.taken_at,
    label: r.adherence,
    tone: ADHERENCE_TONE[r.adherence] ?? "neutral",
  }));
  const taken = rows.filter((r) => r.adherence === "taken" || r.adherence === "partial").length;
  return {
    key: "doses",
    label: "Doses",
    kind: "events",
    unit: null,
    min: null,
    max: null,
    events,
    summary: `${taken}/${rows.length} taken`,
    readAt: (d) => {
      const n = rows.filter((r) => dayOf(r.taken_at) === d).length;
      return n ? `${n} dose${n > 1 ? "s" : ""}` : null;
    },
  };
}

export function shapeTrainingLane(rows: WorkoutRow[], scale: TimeScale): TimelineLane {
  const totalMin = rows.reduce((a, r) => a + (r.duration_min ?? 0), 0);
  const events: EventDot[] = rows.map((r) => ({
    frac: scale.frac(toMs(r.date)),
    dateISO: r.date,
    label: r.session_type,
    tone: "accent",
  }));
  return {
    key: "training",
    label: "Training",
    kind: "markers",
    unit: "min",
    min: null,
    max: null,
    events,
    summary: rows.length ? `${rows.length}× · ${num(totalMin)} min` : "—",
    readAt: (d) => {
      const day = rows.filter((r) => r.date === d);
      if (!day.length) return null;
      return day
        .map((r) => `${r.session_type}${r.duration_min ? ` ${r.duration_min}m` : ""}${r.perceived_exertion ? ` RPE${r.perceived_exertion}` : ""}`)
        .join(", ");
    },
  };
}

export function shapeGoalMetricLanes(rows: GoalMetricRow[], scale: TimeScale): TimelineLane[] {
  const byKey = new Map<string, GoalMetricRow[]>();
  for (const r of rows) {
    const arr = byKey.get(r.metric_key) ?? [];
    arr.push(r);
    byKey.set(r.metric_key, arr);
  }
  const out: TimelineLane[] = [];
  for (const [key, arr] of byKey) {
    arr.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
    const def = METRIC_BY_KEY[key];
    const vals = arr.map((r) => Number(r.value));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const line: LinePoint[] = arr.map((r) => ({
      frac: scale.frac(toMs(r.logged_at)),
      v: Number(r.value),
      vFrac: vFracOf(Number(r.value), min, max),
      dateISO: r.logged_at,
    }));
    const unit = def?.unit === "rating" ? "/10" : (arr[0]?.unit ?? def?.unit ?? null);
    const first = arr[0];
    const last = arr[arr.length - 1];
    out.push({
      key: `goal:${key}`,
      label: def?.label ?? key,
      kind: "line",
      unit,
      min,
      max,
      line,
      summary: first && last ? `${num(Number(first.value), 1)}→${num(Number(last.value), 1)}` : "—",
      readAt: (d) => {
        const p = nearestByDay(line, d);
        return p ? `${num(p.v, 1)}${unit ?? ""}` : null;
      },
    });
  }
  return out;
}

export function shapeLabsLane(rows: LabRow[], scale: TimeScale): TimelineLane {
  // One marker per draw day. The scrub readout lists that day's markers and flags
  // out-of-range values FOR CLINICIAN DISCUSSION — never interpreted/diagnosed.
  const byDay = new Map<string, LabRow[]>();
  for (const r of rows) {
    const day = dayOf(r.collected_on);
    const arr = byDay.get(day) ?? [];
    arr.push(r);
    byDay.set(day, arr);
  }
  const days = [...byDay.keys()].sort();
  const events: EventDot[] = days.map((d) => {
    const flagged = byDay.get(d)!.some((r) => {
      const range = effectiveRange(r.marker_key, r.ref_low, r.ref_high);
      return rangeStatus(r.value, range.low, range.high) !== "in";
    });
    return { frac: scale.frac(toMs(d)), dateISO: d, label: "labs", tone: flagged ? "warn" : "neutral" };
  });
  return {
    key: "labs",
    label: "Labs",
    kind: "markers",
    unit: null,
    min: null,
    max: null,
    events,
    summary: days.length ? `${days.length} draw${days.length > 1 ? "s" : ""}` : "—",
    readAt: (d) => {
      const draw = byDay.get(d);
      if (!draw) return null;
      const parts = draw.map((r) => {
        const range = effectiveRange(r.marker_key, r.ref_low, r.ref_high);
        const st = rangeStatus(r.value, range.low, range.high);
        const arrow = st === "high" ? "↑" : st === "low" ? "↓" : "";
        return `${r.marker} ${num(Number(r.value), 1)}${arrow}`;
      });
      const anyFlag = draw.some((r) => {
        const range = effectiveRange(r.marker_key, r.ref_low, r.ref_high);
        return rangeStatus(r.value, range.low, range.high) !== "in";
      });
      return `${parts.join(", ")}${anyFlag ? " — discuss flags with a clinician" : ""}`;
    },
  };
}

export function shapeSpendLane(rows: PurchaseRow[], scale: TimeScale): TimelineLane {
  const total = rows.reduce((a, r) => a + Number(r.price_usd), 0);
  const events: EventDot[] = rows.map((r) => ({
    frac: scale.frac(toMs(r.purchased_on)),
    dateISO: r.purchased_on,
    label: `$${num(Number(r.price_usd))}`,
    tone: "neutral",
  }));
  return {
    key: "spend",
    label: "Spend",
    kind: "events",
    unit: "$",
    min: null,
    max: null,
    events,
    summary: `$${num(total)}`,
    readAt: (d) => {
      const day = rows.filter((r) => r.purchased_on === d);
      return day.length ? `$${num(day.reduce((a, r) => a + Number(r.price_usd), 0))}` : null;
    },
  };
}

export function shapeActivePeptideLane(regimen: RegimenLike, scale: TimeScale): TimelineLane {
  // One gantt row per compound; the bar spans the union of its item windows.
  const byCompound = new Map<string, { startMs: number; endMs: number }>();
  const nowMs = scale.endMs;
  for (const phase of regimen.phases) {
    const phaseStart = phase.starts_on ? toMs(phase.starts_on) : scale.startMs;
    const phaseEnd = phase.ends_on ? toMs(phase.ends_on) : nowMs;
    for (const item of phase.items) {
      const name = item.compound?.name;
      if (!name) continue;
      const start = item.starts_on ? toMs(item.starts_on) : phaseStart;
      const end = item.ends_on ? toMs(item.ends_on) : phaseEnd;
      const prev = byCompound.get(name);
      byCompound.set(name, {
        startMs: prev ? Math.min(prev.startMs, start) : start,
        endMs: prev ? Math.max(prev.endMs, end) : end,
      });
    }
  }
  const names = [...byCompound.keys()].sort();
  const intervals: IntervalSeg[] = names.map((name, row) => {
    const { startMs, endMs } = byCompound.get(name)!;
    return {
      x0: scale.frac(startMs),
      x1: scale.frac(endMs),
      row,
      label: name,
      tone: "accent",
    };
  });
  return {
    key: "active-peptides",
    label: "Active peptides",
    kind: "intervals",
    unit: null,
    min: null,
    max: null,
    intervals,
    rowCount: names.length,
    summary: names.length ? `${names.length} active` : "—",
    readAt: (d) => {
      const dMs = +new Date(`${d}T00:00:00`);
      const active = names.filter((n) => {
        const { startMs, endMs } = byCompound.get(n)!;
        return dMs >= startMs && dMs <= endMs;
      });
      return active.length ? active.join(", ") : null;
    },
  };
}

export interface TimelineInput {
  range: { startISO: string; endISO: string };
  weights: WeightRow[];
  foods: FoodRow[];
  doses: DoseRow[];
  workouts: WorkoutRow[];
  goalMetrics: GoalMetricRow[];
  labs: LabRow[];
  purchases: PurchaseRow[];
  regimen: RegimenLike | null;
}

export function buildTimelineModel(input: TimelineInput): TimelineModel {
  const { buildTimeScale } = require("./scale") as typeof import("./scale");
  const scale = buildTimeScale(input.range.startISO, input.range.endISO);
  const lanes: TimelineLane[] = [];

  if (input.weights.length) lanes.push(shapeWeightLane(input.weights, scale));
  if (input.regimen && input.regimen.phases.some((p) => p.items.length))
    lanes.push(shapeActivePeptideLane(input.regimen, scale));
  if (input.doses.length) lanes.push(shapeDoseLane(input.doses, scale));
  if (input.foods.length) {
    const [cal, pro] = shapeFoodLanes(input.foods, scale);
    lanes.push(cal, pro);
  }
  if (input.workouts.length) lanes.push(shapeTrainingLane(input.workouts, scale));
  for (const lane of shapeGoalMetricLanes(input.goalMetrics, scale)) lanes.push(lane);
  if (input.labs.length) lanes.push(shapeLabsLane(input.labs, scale));
  if (input.purchases.length) lanes.push(shapeSpendLane(input.purchases, scale));

  return {
    startISO: input.range.startISO,
    endISO: input.range.endISO,
    ticks: scale.ticks(5),
    lanes,
  };
}
```

> **Note on the `require` in `buildTimelineModel`:** ESM `import` of `buildTimeScale` at the top is cleaner — replace the `require` line with a top-level `import { buildTimeScale } from "./scale";` and delete the inline `const { buildTimeScale } = ...` line. (The top-level import is already used for `toMs`/`TimeScale`; just extend it: `import { buildTimeScale, toMs, type TimeScale } from "./scale";`.) Use the top-level import — the `require` form is shown only to flag the dependency.

- [ ] **Step 4: Fix the import (per the note above)**

Edit `packages/shared/src/timeline/shapers.ts`: change the top import to
`import { buildTimeScale, toMs, type TimeScale } from "./scale";` and delete the
`const { buildTimeScale } = require("./scale") ...` line inside `buildTimelineModel`.

- [ ] **Step 5: Run the test, verify it passes**

Run: `pnpm test:timeline`
Expected: all assertions pass (`13 passed, 0 failed` or similar).

- [ ] **Step 6: Typecheck the shared package**

Run: `pnpm turbo run typecheck`
Expected: 16/16 pass (the `./timeline` export now resolves; barrel complete).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/timeline/shapers.ts scripts/test-timeline.mjs
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): stream shapers + buildTimelineModel (TDD)" --no-verify
```

---

## Task 3: Web — range-scoped query loader

**Files:**
- Create: `apps/web/lib/queries/timeline.ts`

The loader fetches every stream within `[from, to]` in one `Promise.all` and returns raw rows in the exact shapes the shapers expect, plus the shaped `ActiveRegimenView` (regimen is range-independent — the model clips intervals to the range).

- [ ] **Step 1: Implement the loader**

Create `apps/web/lib/queries/timeline.ts`:

```ts
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import {
  buildTimelineModel,
  type TimelineInput,
  type RegimenLike,
} from "@peptide/shared/timeline";

export interface TimelineRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export type TimelineLoad = TimelineInput;

export async function loadTimeline(userId: string, range: TimelineRange): Promise<TimelineLoad> {
  const supabase = await createSupabaseServerClient();
  const fromTs = `${range.from}T00:00:00`;
  const toTs = `${range.to}T23:59:59.999`;

  const [weights, foods, doses, workouts, goalMetrics, labs, purchases, regimen] = await Promise.all([
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs)
      .order("logged_at", { ascending: true }),
    supabase
      .from("food_logs")
      .select("logged_at,calories_kcal,protein_g")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs),
    supabase
      .from("peptide_doses")
      .select("taken_at,adherence")
      .eq("user_id", userId)
      .gte("taken_at", fromTs)
      .lte("taken_at", toTs),
    supabase
      .from("workouts")
      .select("date,session_type,duration_min,perceived_exertion")
      .eq("user_id", userId)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("goal_metrics")
      .select("metric_key,value,unit,logged_at")
      .eq("user_id", userId)
      .gte("logged_at", fromTs)
      .lte("logged_at", toTs)
      .order("logged_at", { ascending: true }),
    supabase
      .from("lab_results")
      .select("collected_on,marker,marker_key,value,unit,ref_low,ref_high")
      .eq("user_id", userId)
      .gte("collected_on", range.from)
      .lte("collected_on", range.to),
    supabase
      .from("peptide_purchases")
      .select("purchased_on,price_usd")
      .eq("user_id", userId)
      .gte("purchased_on", range.from)
      .lte("purchased_on", range.to),
    loadActiveRegimen(userId),
  ]);

  const regimenLike: RegimenLike | null = regimen
    ? {
        phases: regimen.phases.map((p) => ({
          starts_on: p.starts_on,
          ends_on: p.ends_on,
          items: p.items.map((i) => ({
            compound: i.compound ? { name: i.compound.name } : null,
            starts_on: i.starts_on,
            ends_on: i.ends_on,
          })),
        })),
      }
    : null;

  return {
    range: { startISO: range.from, endISO: range.to },
    weights: (weights.data ?? []).map((w) => ({ logged_at: w.logged_at, value_lb: Number(w.value_lb) })),
    foods: (foods.data ?? []).map((f) => ({
      logged_at: f.logged_at,
      calories_kcal: Number(f.calories_kcal),
      protein_g: Number(f.protein_g),
    })),
    doses: (doses.data ?? []).map((d) => ({ taken_at: d.taken_at, adherence: d.adherence })),
    workouts: (workouts.data ?? []).map((w) => ({
      date: w.date,
      session_type: w.session_type,
      duration_min: w.duration_min,
      perceived_exertion: w.perceived_exertion,
    })),
    goalMetrics: (goalMetrics.data ?? []).map((g) => ({
      metric_key: g.metric_key,
      value: Number(g.value),
      unit: g.unit,
      logged_at: g.logged_at,
    })),
    labs: (labs.data ?? []).map((l) => ({
      collected_on: l.collected_on,
      marker: l.marker,
      marker_key: l.marker_key,
      value: Number(l.value),
      unit: l.unit,
      ref_low: l.ref_low !== null ? Number(l.ref_low) : null,
      ref_high: l.ref_high !== null ? Number(l.ref_high) : null,
    })),
    purchases: (purchases.data ?? []).map((p) => ({
      purchased_on: p.purchased_on,
      price_usd: Number(p.price_usd),
    })),
    regimen: regimenLike,
  };
}
```

> **Do NOT re-export `buildTimelineModel` from this `server-only` loader.** The
> client component must import `buildTimelineModel` (and the `TimelineInput`
> type) directly from `@peptide/shared/timeline`. Re-exporting it here and
> importing that value from a client component pulls the `server-only` module
> into the client bundle and fails the Next.js build.

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo run typecheck`
Expected: 16/16. (If `@peptide/shared/timeline` is unresolved in web, confirm Task 1 Step 7 added the export.)

> NOTE: typecheck does NOT catch the `server-only`-in-client-bundle error — that
> only surfaces in `next build` (i.e. on Vercel). Keep this loader free of any
> value the client imports.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/timeline.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): web range-scoped query loader" --no-verify
```

---

## Task 4: Web — SVG lane renderer + crosshair

**Files:**
- Create: `apps/web/components/timeline/timeline-lanes.tsx`

A single client component renders the full lane stack as one wide `<svg>` per lane row (shared width), plus an absolutely-positioned crosshair line driven by parent pointer state. Geometry uses the model's fractions × the measured plot width. Mirror the `projections.tsx` viewBox approach but in CSS px via a `ResizeObserver`-free fixed `viewBox` width (`100`) so fractions map directly: `x = frac * 100`.

- [ ] **Step 1: Implement the renderer**

Create `apps/web/components/timeline/timeline-lanes.tsx`:

```tsx
"use client";

import type { TimelineLane, TimelineModel } from "@peptide/shared/timeline";

const TONE: Record<string, string> = {
  neutral: "var(--fg-subtle)",
  good: "var(--success, var(--primary))",
  warn: "var(--warning, var(--primary))",
  bad: "var(--danger)",
  accent: "var(--primary)",
};

const LANE_H = 48; // px plot height per lane
const VB_W = 1000; // viewBox width; frac → x is frac*VB_W

function laneX(frac: number) {
  return frac * VB_W;
}

function LinePlot({ lane }: { lane: TimelineLane }) {
  const pts = (lane.line ?? [])
    .map((p) => `${laneX(p.frac).toFixed(1)},${((1 - p.vFrac) * (LANE_H - 8) + 4).toFixed(1)}`)
    .join(" ");
  return (
    <>
      {(lane.line ?? []).length > 1 && (
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
      {(lane.line ?? []).map((p, i) => (
        <circle key={i} cx={laneX(p.frac)} cy={(1 - p.vFrac) * (LANE_H - 8) + 4} r={2.4} fill="var(--primary)" />
      ))}
    </>
  );
}

function BarPlot({ lane }: { lane: TimelineLane }) {
  const bw = 4;
  return (
    <>
      {(lane.bars ?? []).map((b, i) => {
        const h = Math.max(1, b.vFrac * (LANE_H - 6));
        return (
          <rect
            key={i}
            x={laneX(b.frac) - bw / 2}
            y={LANE_H - h - 2}
            width={bw}
            height={h}
            rx={1}
            fill="var(--primary)"
            opacity={0.55}
          />
        );
      })}
    </>
  );
}

function EventPlot({ lane, marker }: { lane: TimelineLane; marker?: boolean }) {
  const cy = LANE_H / 2;
  return (
    <>
      {(lane.events ?? []).map((e, i) =>
        marker ? (
          <rect key={i} x={laneX(e.frac) - 3} y={cy - 5} width={6} height={10} rx={1.5} fill={TONE[e.tone]} />
        ) : (
          <circle key={i} cx={laneX(e.frac)} cy={cy} r={3.2} fill={TONE[e.tone]} />
        ),
      )}
    </>
  );
}

function IntervalPlot({ lane }: { lane: TimelineLane }) {
  const rows = lane.rowCount ?? 1;
  const rowH = (LANE_H - 4) / Math.max(1, rows);
  return (
    <>
      {(lane.intervals ?? []).map((seg, i) => (
        <rect
          key={i}
          x={laneX(seg.x0)}
          y={2 + seg.row * rowH + 1}
          width={Math.max(2, laneX(seg.x1) - laneX(seg.x0))}
          height={rowH - 2}
          rx={2}
          fill={TONE[seg.tone]}
          opacity={0.35}
        />
      ))}
    </>
  );
}

function LaneBody({ lane }: { lane: TimelineLane }) {
  switch (lane.kind) {
    case "line":
      return <LinePlot lane={lane} />;
    case "bars":
      return <BarPlot lane={lane} />;
    case "events":
      return <EventPlot lane={lane} />;
    case "markers":
      return <EventPlot lane={lane} marker />;
    case "intervals":
      return <IntervalPlot lane={lane} />;
    default:
      return null;
  }
}

export function TimelineLanes({
  model,
  hidden,
  scrubFrac,
  onScrub,
}: {
  model: TimelineModel;
  hidden: Set<string>;
  scrubFrac: number | null;
  onScrub: (frac: number | null) => void;
}) {
  const lanes = model.lanes.filter((l) => !hidden.has(l.key));
  return (
    <div
      className="relative"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onScrub(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      onPointerLeave={() => onScrub(null)}
    >
      {lanes.map((lane) => (
        <div key={lane.key} className="flex items-stretch border-b border-[var(--border)]">
          <div className="w-28 shrink-0 py-2 pr-2">
            <div className="text-2xs font-medium text-[var(--fg)]">{lane.label}</div>
            <div className="font-[family-name:var(--font-mono)] text-2xs tabular-nums text-[var(--fg-subtle)]">
              {lane.summary}
            </div>
          </div>
          <svg
            className="min-w-0 flex-1"
            height={LANE_H}
            viewBox={`0 0 ${VB_W} ${LANE_H}`}
            preserveAspectRatio="none"
          >
            <LaneBody lane={lane} />
          </svg>
        </div>
      ))}
      {scrubFrac !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--primary)]"
          style={{ left: `calc(7rem + (100% - 7rem) * ${scrubFrac})` }}
        />
      )}
    </div>
  );
}
```

> The crosshair `left` accounts for the 7rem (w-28) label gutter; the plot occupies `100% - 7rem`.

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo run typecheck`
Expected: 16/16.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/timeline/timeline-lanes.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): web SVG lane renderer + crosshair" --no-verify
```

---

## Task 5: Web — page shell + client (range, scrub readout, visibility)

**Files:**
- Create: `apps/web/app/(app)/timeline/page.tsx`
- Create: `apps/web/app/(app)/timeline/timeline-client.tsx`

- [ ] **Step 1: Implement the SSR shell**

Create `apps/web/app/(app)/timeline/page.tsx` (mirrors the inventory range-preset SSR pattern):

```tsx
import { requireUser } from "@/lib/auth";
import { loadTimeline } from "@/lib/queries/timeline";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { TimelineClient } from "./timeline-client";

export const dynamic = "force-dynamic";

const PRESETS = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "Year" },
  { key: "all", label: "All time" },
] as const;

function rangeFor(key: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to };
  if (key === "all") return { from: "2020-01-01", to };
  // default 90d
  return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10), to };
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeKey = "90d" } = await searchParams;
  const range = rangeFor(rangeKey);
  const data = await loadTimeline(user.id, range);

  return (
    <div>
      <SectionHeader title="Timeline" note="everything, one date range · read-only" />
      <p className="mb-4 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        Every stream you track — doses, peptides, food, training, weight, goal metrics, labs, and
        spend — over the same dates. Scrub across to read any day. This is a view of what you logged;
        it does not interpret results or prescribe.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = p.key === rangeKey || (rangeKey === "90d" && p.key === "90d");
          return (
            <a
              key={p.key}
              href={`/timeline?range=${p.key}`}
              className={`rounded-[var(--r-pill)] border px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium transition-colors ${
                active
                  ? "border-[var(--primary-line)] bg-[var(--primary-wash)] text-[var(--primary-bright)]"
                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--primary-line)]"
              }`}
            >
              {p.label}
            </a>
          );
        })}
      </div>

      <TimelineClient data={data} />

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement the client**

Create `apps/web/app/(app)/timeline/timeline-client.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
// Import the model + type from the client-safe shared package — NOT from the
// server-only loader (importing a value from a "server-only" module into a
// client component breaks the Next.js build).
import { buildTimelineModel, type TimelineInput } from "@peptide/shared/timeline";
import { TimelineLanes } from "@/components/timeline/timeline-lanes";
import { Card } from "@/components/kit";

const STORE_KEY = "timeline:hidden";

export function TimelineClient({ data }: { data: TimelineInput }) {
  const model = useMemo(() => buildTimelineModel(data), [data]);
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);

  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Readout date for the focused fraction.
  const focusISO = useMemo(() => {
    if (scrubFrac === null) return null;
    const startMs = +new Date(`${model.startISO}T00:00:00`);
    const endMs = +new Date(`${model.endISO}T23:59:59`);
    const ms = startMs + (endMs - startMs) * scrubFrac;
    return new Date(ms).toISOString().slice(0, 10);
  }, [scrubFrac, model.startISO, model.endISO]);

  if (model.lanes.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-[var(--fg-muted)]">
          Nothing logged in this range yet. Log weight, food, doses, or training to see your timeline.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* readout header */}
      <Card>
        <div className="mb-2 font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--fg)]">
          {focusISO ? new Date(`${focusISO}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Hover / scrub to read a day"}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {model.lanes
            .filter((l) => !hidden.has(l.key))
            .map((l) => {
              const v = focusISO ? l.readAt(focusISO) : null;
              return (
                <div key={l.key} className="flex items-center justify-between gap-2 text-2xs">
                  <span className="text-[var(--fg-subtle)]">{l.label}</span>
                  <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                    {v ?? "—"}
                  </span>
                </div>
              );
            })}
        </div>
      </Card>

      {/* axis ticks */}
      <div className="flex pl-28">
        {model.ticks.map((t, i) => (
          <span
            key={i}
            className="flex-1 font-[family-name:var(--font-mono)] text-2xs text-[var(--fg-subtle)]"
            style={{ textAlign: i === 0 ? "left" : i === model.ticks.length - 1 ? "right" : "center" }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* lanes */}
      <Card className="overflow-hidden p-0">
        <TimelineLanes model={model} hidden={hidden} scrubFrac={scrubFrac} onScrub={setScrubFrac} />
      </Card>

      {/* visibility toggles */}
      <div className="flex flex-wrap gap-1.5">
        {model.lanes.map((l) => {
          const off = hidden.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => toggle(l.key)}
              className={`rounded-[var(--r-pill)] border px-2.5 py-1 text-2xs font-medium transition-colors ${
                off
                  ? "border-[var(--border)] bg-transparent text-[var(--fg-subtle)] line-through"
                  : "border-[var(--primary-line)] bg-[var(--primary-wash)] text-[var(--primary-bright)]"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

> Confirm `Card` accepts a `className` prop (it's used with `className` in inventory? if not, wrap the toggle list and lanes div directly). If `Card` has no `className`, replace `<Card className="overflow-hidden p-0">…</Card>` with a plain `<div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]">…</div>`. Verify by reading `apps/web/components/kit.tsx` `Card` signature in Step 3.

- [ ] **Step 3: Verify `Card`/`SectionHeader` props, fix if needed**

Run: `grep -n "export function Card\|export function SectionHeader" apps/web/components/kit.tsx`
Read the `Card` signature. If it does not accept `className`, apply the fallback from the note above.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo run typecheck`
Expected: 16/16.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/timeline/page.tsx apps/web/app/\(app\)/timeline/timeline-client.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): web page shell + client (range, scrub, toggles)" --no-verify
```

---

## Task 6: Web — nav entry

**Files:**
- Modify: `apps/web/components/nav.tsx`

- [ ] **Step 1: Add the icon import + nav item**

In `apps/web/components/nav.tsx`, add `GanttChartSquare` to the lucide import block (alphabetical, near `FlaskRound`), then add to `NAV_ITEMS` after the `/projections` entry:

```tsx
  { href: "/projections", label: "Projections", icon: BarChart3 },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/alerts", label: "Alerts", icon: Bell },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo run typecheck`
Expected: 16/16. (If `GanttChartSquare` is not exported by the installed lucide version, use `GanttChart` or `Activity`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/nav.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): add Timeline to web nav" --no-verify
```

---

## Task 7: Web — deploy + verify live

- [ ] **Step 1: Push and let Vercel deploy**

```bash
git push origin main
```

- [ ] **Step 2: Confirm the deploy is READY**

Wait for the Vercel deploy, then check the route guards an unauthenticated request:
Run: `curl -s -o /dev/null -w "%{http_code}" https://recompiq.vercel.app/timeline`
Expected: `307` (redirect to login — route exists and is auth-gated).

- [ ] **Step 3: Playwright overflow + visual check at 390px**

Use the `/tmp/ofcheck` harness (login as demo `demo@recompiq.app` / `DemoUser!2026`, navigate to `/timeline`, measure `document.documentElement.scrollWidth`).
Run: `cd /tmp/ofcheck && node verify.mjs /timeline` (or add `/timeline` to its screen list).
Expected: `scrollWidth == 390` at the 390px viewport (no horizontal overflow); lanes render; scrubbing updates the readout. Capture a screenshot to `tmp/verify/`.

> If overflow appears, the usual cause is the `min-w-0` rule — confirm the lane `<svg>` has `min-w-0 flex-1` (it does) and the page sits inside the app column that already has `min-w-0`.

---

## Task 8: Mobile — range-scoped reader

**Files:**
- Create: `apps/mobile/lib/timeline.ts`

- [ ] **Step 1: Implement the reader**

Create `apps/mobile/lib/timeline.ts` (mirrors `apps/mobile/lib/labs.ts` + the web loader, via supabase-js):

```ts
import { buildTimelineModel, type TimelineInput, type RegimenLike } from "@peptide/shared/timeline";
import { supabase } from "@/lib/supabase";

export interface TimelineRange {
  from: string;
  to: string;
}

export async function loadTimeline(userId: string, range: TimelineRange): Promise<TimelineInput> {
  const fromTs = `${range.from}T00:00:00`;
  const toTs = `${range.to}T23:59:59.999`;

  const [weights, foods, doses, workouts, goalMetrics, labs, purchases, regimen] = await Promise.all([
    supabase.from("weights").select("logged_at,value_lb").eq("user_id", userId).gte("logged_at", fromTs).lte("logged_at", toTs).order("logged_at", { ascending: true }),
    supabase.from("food_logs").select("logged_at,calories_kcal,protein_g").eq("user_id", userId).gte("logged_at", fromTs).lte("logged_at", toTs),
    supabase.from("peptide_doses").select("taken_at,adherence").eq("user_id", userId).gte("taken_at", fromTs).lte("taken_at", toTs),
    supabase.from("workouts").select("date,session_type,duration_min,perceived_exertion").eq("user_id", userId).gte("date", range.from).lte("date", range.to),
    supabase.from("goal_metrics").select("metric_key,value,unit,logged_at").eq("user_id", userId).gte("logged_at", fromTs).lte("logged_at", toTs).order("logged_at", { ascending: true }),
    supabase.from("lab_results").select("collected_on,marker,marker_key,value,unit,ref_low,ref_high").eq("user_id", userId).gte("collected_on", range.from).lte("collected_on", range.to),
    supabase.from("peptide_purchases").select("purchased_on,price_usd").eq("user_id", userId).gte("purchased_on", range.from).lte("purchased_on", range.to),
    supabase
      .from("regimens")
      .select("regimen_phases(starts_on,ends_on, regimen_items(starts_on,ends_on, compounds(name)))")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reg = regimen.data as
    | { regimen_phases?: Array<{ starts_on: string | null; ends_on: string | null; regimen_items?: Array<{ starts_on: string | null; ends_on: string | null; compounds?: { name: string } | { name: string }[] | null }> }> }
    | null;
  const regimenLike: RegimenLike | null = reg
    ? {
        phases: (reg.regimen_phases ?? []).map((p) => ({
          starts_on: p.starts_on,
          ends_on: p.ends_on,
          items: (p.regimen_items ?? []).map((i) => {
            const c = Array.isArray(i.compounds) ? i.compounds[0] : i.compounds;
            return { compound: c?.name ? { name: c.name } : null, starts_on: i.starts_on, ends_on: i.ends_on };
          }),
        })),
      }
    : null;

  return {
    range: { startISO: range.from, endISO: range.to },
    weights: (weights.data ?? []).map((w) => ({ logged_at: w.logged_at as string, value_lb: Number(w.value_lb) })),
    foods: (foods.data ?? []).map((f) => ({ logged_at: f.logged_at as string, calories_kcal: Number(f.calories_kcal), protein_g: Number(f.protein_g) })),
    doses: (doses.data ?? []).map((d) => ({ taken_at: d.taken_at as string, adherence: d.adherence as string })),
    workouts: (workouts.data ?? []).map((w) => ({ date: w.date as string, session_type: w.session_type as string, duration_min: w.duration_min as number | null, perceived_exertion: w.perceived_exertion as number | null })),
    goalMetrics: (goalMetrics.data ?? []).map((g) => ({ metric_key: g.metric_key as string, value: Number(g.value), unit: (g.unit as string | null) ?? null, logged_at: g.logged_at as string })),
    labs: (labs.data ?? []).map((l) => ({ collected_on: l.collected_on as string, marker: l.marker as string, marker_key: (l.marker_key as string | null) ?? null, value: Number(l.value), unit: (l.unit as string | null) ?? null, ref_low: l.ref_low !== null ? Number(l.ref_low) : null, ref_high: l.ref_high !== null ? Number(l.ref_high) : null })),
    purchases: (purchases.data ?? []).map((p) => ({ purchased_on: p.purchased_on as string, price_usd: Number(p.price_usd) })),
    regimen: regimenLike,
  };
}

export { buildTimelineModel };
```

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo run typecheck`
Expected: 16/16.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/timeline.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): mobile range-scoped reader" --no-verify
```

---

## Task 9: Mobile — timeline screen (SVG lanes + pan scrub)

**Files:**
- Create: `apps/mobile/app/(tabs)/more/timeline.tsx`

Renders the same shared model with `react-native-svg`. Range as a segmented control; scrub via a `PanResponder` on the lane stack updating a shared focus fraction; readout above. Mirror the `projections.tsx` SVG idiom (`Svg` with viewBox, `Polyline/Rect/Circle/Line`).

- [ ] **Step 1: Implement the screen**

Create `apps/mobile/app/(tabs)/more/timeline.tsx`:

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { PanResponder, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { buildTimelineModel, loadTimeline, type TimelineRange } from "@/lib/timeline";
import type { TimelineInput } from "@peptide/shared/timeline";
import { Content } from "@/components/ui/Content";
import { Card } from "@/components/ui/Card";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { colors } from "@/lib/theme";
import { useSession } from "@/lib/session";

const VB_W = 1000;
const LANE_H = 44;

const TONE: Record<string, string> = {
  neutral: colors.mutedForeground,
  good: colors.primary,
  warn: colors.primary,
  bad: colors.destructive,
  accent: colors.primary,
};

const PRESETS: { key: string; label: string }[] = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ytd", label: "Year" },
  { key: "all", label: "All" },
];

function rangeFor(key: string): TimelineRange {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to };
  if (key === "all") return { from: "2020-01-01", to };
  return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10), to };
}

export default function Timeline() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [rangeKey, setRangeKey] = useState("90d");
  const [data, setData] = useState<TimelineInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frac, setFrac] = useState<number | null>(null);
  const widthRef = useRef(1);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!uid) return;
      setLoading(true);
      setError(false);
      loadTimeline(uid, rangeFor(rangeKey))
        .then((d) => alive && setData(d))
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [uid, rangeKey]),
  );

  const model = useMemo(() => (data ? buildTimelineModel(data) : null), [data]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.locationX;
          setFrac(Math.min(1, Math.max(0, x / Math.max(1, widthRef.current))));
        },
        onPanResponderRelease: () => {},
      }),
    [],
  );

  const focusISO = useMemo(() => {
    if (!model || frac === null) return null;
    const startMs = +new Date(`${model.startISO}T00:00:00`);
    const endMs = +new Date(`${model.endISO}T23:59:59`);
    return new Date(startMs + (endMs - startMs) * frac).toISOString().slice(0, 10);
  }, [model, frac]);

  return (
    <Content>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>Timeline</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
        Everything you track over one date range. Drag across to read a day. Read-only — no advice.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {PRESETS.map((p) => {
          const active = p.key === rangeKey;
          return (
            <Text
              key={p.key}
              onPress={() => setRangeKey(p.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                overflow: "hidden",
                fontSize: 12,
                fontWeight: "600",
                color: active ? colors.primary : colors.mutedForeground,
                backgroundColor: active ? colors.primaryWash ?? "rgba(0,0,0,0.04)" : "transparent",
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              {p.label}
            </Text>
          );
        })}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState />
      ) : !model || model.lanes.length === 0 ? (
        <EmptyState title="Nothing logged in this range" subtitle="Log weight, food, doses, or training to see your timeline." />
      ) : (
        <>
          {/* readout */}
          <Card>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
              {focusISO
                ? new Date(`${focusISO}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "Drag across to read a day"}
            </Text>
            {model.lanes.map((l) => (
              <View key={l.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{l.label}</Text>
                <Text style={{ color: colors.foreground, fontSize: 11, fontVariant: ["tabular-nums"] }}>
                  {(focusISO && l.readAt(focusISO)) || "—"}
                </Text>
              </View>
            ))}
          </Card>

          {/* lanes */}
          <Card>
            <View
              {...pan.panHandlers}
              onLayout={(e) => {
                widthRef.current = e.nativeEvent.layout.width;
              }}
            >
              {model.lanes.map((lane) => (
                <View key={lane.key} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 10, fontWeight: "600" }}>
                    {lane.label} <Text style={{ color: colors.mutedForeground }}>· {lane.summary}</Text>
                  </Text>
                  <Svg width="100%" height={LANE_H} viewBox={`0 0 ${VB_W} ${LANE_H}`} preserveAspectRatio="none">
                    <LaneBody lane={lane} />
                    {frac !== null && (
                      <Line x1={frac * VB_W} y1={0} x2={frac * VB_W} y2={LANE_H} stroke={colors.primary} strokeWidth={1} />
                    )}
                  </Svg>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Content>
  );
}

function LaneBody({ lane }: { lane: ReturnType<typeof buildTimelineModel>["lanes"][number] }) {
  if (lane.kind === "line") {
    const pts = (lane.line ?? []).map((p) => `${(p.frac * VB_W).toFixed(1)},${((1 - p.vFrac) * (LANE_H - 8) + 4).toFixed(1)}`).join(" ");
    return (
      <>
        {(lane.line ?? []).length > 1 && <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={2} />}
        {(lane.line ?? []).map((p, i) => (
          <Circle key={i} cx={p.frac * VB_W} cy={(1 - p.vFrac) * (LANE_H - 8) + 4} r={3} fill={colors.primary} />
        ))}
      </>
    );
  }
  if (lane.kind === "bars") {
    return (
      <>
        {(lane.bars ?? []).map((b, i) => {
          const h = Math.max(1, b.vFrac * (LANE_H - 6));
          return <Rect key={i} x={b.frac * VB_W - 3} y={LANE_H - h - 2} width={6} height={h} rx={1} fill={colors.primary} opacity={0.55} />;
        })}
      </>
    );
  }
  if (lane.kind === "events" || lane.kind === "markers") {
    const cy = LANE_H / 2;
    return (
      <>
        {(lane.events ?? []).map((e, i) =>
          lane.kind === "markers" ? (
            <Rect key={i} x={e.frac * VB_W - 4} y={cy - 6} width={8} height={12} rx={2} fill={TONE[e.tone]} />
          ) : (
            <Circle key={i} cx={e.frac * VB_W} cy={cy} r={4} fill={TONE[e.tone]} />
          ),
        )}
      </>
    );
  }
  if (lane.kind === "intervals") {
    const rows = lane.rowCount ?? 1;
    const rowH = (LANE_H - 4) / Math.max(1, rows);
    return (
      <>
        {(lane.intervals ?? []).map((seg, i) => (
          <Rect key={i} x={seg.x0 * VB_W} y={2 + seg.row * rowH + 1} width={Math.max(3, (seg.x1 - seg.x0) * VB_W)} height={rowH - 2} rx={2} fill={TONE[seg.tone]} opacity={0.35} />
        ))}
      </>
    );
  }
  return null;
}
```

> Confirm the imports `Content`, `Card`, `Loading/ErrorState/EmptyState`, `colors`, `useSession` resolve as in `projections.tsx`. If `colors.primaryWash` is undefined, the `?? "rgba(0,0,0,0.04)"` fallback covers it. Verify `EmptyState`/`ErrorState` prop names against `apps/mobile/components/ui/States.tsx` in Step 2.

- [ ] **Step 2: Verify mobile primitive prop names**

Run: `grep -n "EmptyState\|ErrorState\|export" apps/mobile/components/ui/States.tsx | head` and `grep -n "primaryWash\|primary\b\|border\b" apps/mobile/lib/theme.ts | head`
Adjust `EmptyState`/`ErrorState` props and color keys to match.

- [ ] **Step 3: Export-typecheck the mobile app**

Run: `cd apps/mobile && npx expo export -p ios`
Expected: bundles clean (~5.8 MB, no red errors). Then `cd ../..`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/more/timeline.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): mobile timeline screen (SVG lanes + pan scrub)" --no-verify
```

---

## Task 10: Mobile — More-menu row

**Files:**
- Modify: `apps/mobile/app/(tabs)/more/index.tsx`

- [ ] **Step 1: Add the row**

In `apps/mobile/app/(tabs)/more/index.tsx`, add after the Projections `ListRow` (line ~44):

```tsx
      <ListRow title="Projections" subtitle="Weight trajectory" icon="trending-down-outline" onPress={() => router.push("/(tabs)/more/projections")} />
      <ListRow title="Timeline" subtitle="Everything, one date range" icon="pulse-outline" onPress={() => router.push("/(tabs)/more/timeline")} />
```

- [ ] **Step 2: Export-typecheck**

Run: `cd apps/mobile && npx expo export -p ios && cd ../..`
Expected: clean bundle.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/more/index.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(timeline): add Timeline to mobile More menu" --no-verify
```

---

## Task 11: Demo seed coverage

**Files:**
- Modify (only if a stream is thin): `scripts/seed-demo.mjs`

- [ ] **Step 1: Audit demo coverage across the range**

Read `scripts/seed-demo.mjs` and confirm the demo user gets, spanning ≥90 days: weights, food_logs, peptide_doses, workouts, goal_metrics, lab_results (≥2 draws), peptide_purchases, and an active regimen with phase/item `starts_on` dates. List any stream that is single-point or absent.

- [ ] **Step 2: Extend thin streams (only if needed)**

If a stream is thin, extend its seed block so the 90d timeline reads well (e.g., ensure weights are ~3×/week, doses daily, food daily). Keep all rows `is_demo = true`. Do not fabricate doses beyond what the demo regimen already defines — reuse existing demo dose values.

- [ ] **Step 3: Re-seed and verify**

Run: `node scripts/seed-demo.mjs` (re-runnable per convention).
Expected: completes without error; re-run is idempotent.

- [ ] **Step 4: Commit (if changed)**

```bash
git add scripts/seed-demo.mjs
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "chore(timeline): demo seed spans all timeline lanes" --no-verify
```

---

## Task 12: Safety review + final gates

- [ ] **Step 1: Run the safety reviewer over the labs/dose render paths**

Invoke the `safety-reviewer` agent (or `/safety-check`) over the diff, focusing on `packages/shared/src/timeline/shapers.ts` (dose/labs handling), the web `timeline-lanes.tsx`/`timeline-client.tsx`, and the mobile `timeline.tsx`.
Expected: **0 blockers.** The timeline must not interpret labs or emit any dose/projection. Confirm: doses render as adherence events (no numeric dose text fabricated); the **Labs lane** (`shapeLabsLane`) shows draw markers and flags out-of-range values only as "discuss flags with a clinician" (an out-of-range arrow + that exact phrase — never an interpretation, diagnosis, or recommendation); the page copy says "read-only · does not interpret/prescribe"; and the `SafetyDisclaimer` is present on web.

> Pay special attention to `shapeLabsLane.readAt`: its string must stay factual (value + in/low/high arrow + the clinician-discussion phrase). It must NOT say what a value "means," whether it is "good/bad," or suggest any action. If the reviewer wants softer framing, adjust the wording in `shapeLabsLane` only.

- [ ] **Step 2: Full gate sweep**

```bash
pnpm turbo run typecheck   # expect 16/16
pnpm test:timeline         # expect green
cd apps/mobile && npx expo export -p ios && cd ../..   # clean bundle
```

- [ ] **Step 3: Push + verify deploy**

```bash
git push origin main
```
Then confirm `https://recompiq.vercel.app/timeline` returns `307` unauthenticated and renders for the demo login at 390px (Playwright harness, no overflow).

- [ ] **Step 4: Update session state**

Append a new `🔀 SESSION HANDOFF` block to `.claude/SESSION-STATE.md` summarizing: Phase 7 unified timeline shipped (web + mobile), the shared `@peptide/shared/timeline` model + `pnpm test:timeline`, lanes implemented, labs-lane deferral decision (if taken), and the remaining carryover cleanups.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §2 layout → Tasks 4/5/9. §3 lane model → Tasks 1/2. §4 lanes — **all nine**: weight/active-peptides/doses/calories/protein/training/goal-metrics/**labs**/spend → Task 2 shapers (`shapeWeightLane`, `shapeActivePeptideLane`, `shapeDoseLane`, `shapeFoodLanes`, `shapeTrainingLane`, `shapeGoalMetricLanes`, `shapeLabsLane`, `shapeSpendLane`). §5 web → Tasks 3–6. §6 mobile → Tasks 8–10. §7 calories-burned → honored (Training lane has no fabricated kcal). §8 safety → Task 12 (labs framing called out explicitly). §9 demo → Task 11. §10 gates → Task 12.
- **Full spec scope:** no lanes deferred — the approved "full set" (incl. labs) is implemented. Labs render as status-flagged markers with clinician-discussion framing only.
- **Placeholder scan:** none — every code step has complete code; verification steps have exact commands + expected output.
- **Type consistency:** `TimelineLane`/`TimelineModel`/`TimelineInput`/`RegimenLike`/`LabRow` names are consistent across shaper, web loader, and mobile reader; `buildTimelineModel` signature matches its callers; `frac`/`vFrac`/`readAt` used consistently in both renderers.
