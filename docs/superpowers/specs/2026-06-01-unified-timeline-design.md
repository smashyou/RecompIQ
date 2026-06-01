# Unified Timeline — Design Spec

> Phase 7 of the regimen/goals roadmap (`docs/REGIMEN_GOALS_PRD.md` §5.6 / §8.7).
> Status: approved 2026-06-01. Web + mobile lockstep.

## 1. Goal

One screen that answers "what did I do, and what happened" across **any date
range** in a single synchronized view: doses, active peptides, food
(calories/protein), training, weight, every active goal metric, labs, and spend.
The point is **cause→effect** — read every stream against the same day on one
shared time axis.

Read-only. The timeline shows data the user already entered elsewhere; it does
not create doses, projections, or any new health claim.

## 2. Layout

A standalone page (`/timeline` web, `More → Timeline` mobile):

- **Range control** (top): presets `30d / 90d / YTD / All / Custom`, reusing the
  inventory range pattern (`Range = { start?, end? }`). Custom = two date inputs.
- **Lane stack** (below): a vertical stack of horizontal lanes, all sharing ONE
  x time-scale. Each lane ~44–64px tall: a left label/summary gutter + an SVG
  plot area.
- **Scrub crosshair**: a vertical line follows the pointer (web: mousemove/touch;
  mobile: pan gesture). A sticky **readout header** shows the focused date and
  every lane's `valueAt(date)`.
- **Lane visibility toggles**: collapse lanes you don't care about; persisted to
  `localStorage` (web) / `AsyncStorage` (mobile).

The dense "instrument/terminal" aesthetic is intentional and matches the rest of
the app. Built from the responsive primitives (`<Page>/<PageHeader>` web,
`Content/Screen` + `useResponsive()` mobile); `body { overflow-x: clip }` already
backstops horizontal overflow.

## 3. Core abstraction — the shared lane model

All scaling/placement math is a **pure module** so web and mobile share it and it
is unit-testable in isolation. Lives in `@peptide/shared/timeline` (new subpath;
no DB, no React, no platform deps).

Input: `{ rangeStart: Date, rangeEnd: Date, width: number }` + the raw rows for
each stream. Output: a `TimelineModel`:

```ts
interface TimelineModel {
  xForDate(d: Date | string): number;        // shared scale, px within plot
  rangeStart: Date;
  rangeEnd: Date;
  lanes: Lane[];
}

type LaneKind = 'line' | 'bars' | 'events' | 'intervals' | 'markers';

interface Lane {
  key: string;                 // 'weight', 'doses', 'goal:skin_quality', …
  label: string;
  kind: LaneKind;
  summary: string;             // "268→254 lb", "5× · 142 min", "$435"
  unit?: string;
  // normalized geometry (y already scaled 0..1 within the lane, x in px):
  points?: { x: number; y: number; date: string; raw: number }[];      // line/bars
  events?: { x: number; date: string; label: string; tone?: string }[]; // events/markers
  intervals?: { x0: number; x1: number; row: number; label: string }[]; // intervals (Gantt)
  valueAt(d: Date): string | null;  // for the scrub readout
}
```

Pure helpers: `buildTimelineModel(input)`, plus per-stream shapers
(`shapeWeightLane`, `shapeDoseLane`, `shapeActivePeptideLane`, `shapeFoodLanes`,
`shapeTrainingLane`, `shapeGoalMetricLanes`, `shapeLabsLane`, `shapeSpendLane`).
Each shaper takes already-fetched rows (fetching stays in the platform query
layer) and returns a `Lane`. A `pnpm test:timeline` harness covers: empty range,
single point, x-scale monotonicity, daily-bucket aggregation, interval clipping
at range edges, and `valueAt` lookup.

## 4. The lanes (full set, v1)

| Lane | Source table | Kind | Notes |
|---|---|---|---|
| **Weight** | `weights` (logged_at, value_lb) | line | min/max in summary |
| **Active peptides** | regimen phases + items (start/stop) | intervals | one Gantt row per compound; bar spans the active interval, clipped to range |
| **Doses** | `peptide_doses` (taken_at, adherence) | events | dot per dose, tone by adherence |
| **Calories** | `food_logs` daily Σ calories_kcal | bars | |
| **Protein** | `food_logs` daily Σ protein_g | bars | target line if goal present |
| **Training** | `workouts` (date, session_type, duration_min, perceived_exertion) | markers | sized by duration; label = type + RPE. **No calories-burned** (see §7) |
| **Goal metrics** | `goal_metrics` (metric_key, value, logged_at) | line | **one lane per active `metric_key`** (skin/focus/energy/circumference/cognition…) |
| **Labs** | `lab_results` (collected_on, marker, value, status) | markers | diamond per draw; tap → that draw's markers + range-status flags |
| **Spend** | `peptide_purchases` (purchased_on, price_usd) | events | tick per purchase; running total in summary |

"Active peptides" intervals are derived from each `regimen_items` row's active
window within its phase (start → stop/now), not from individual doses — distinct
from the Doses lane.

## 5. Web implementation

- `app/(app)/timeline/page.tsx` — SSR; calls `lib/queries/timeline.ts`
  `loadTimeline(userId, range)` (one `Promise.all` across all streams), passes
  raw rows to the shared shapers, renders `timeline-client.tsx`.
- `timeline-client.tsx` — `'use client'`: range state, lane visibility, scrub
  pointer state, readout header.
- `components/timeline/lane.tsx` — a plain `<svg>` lane renderer (no Recharts);
  one component switches on `LaneKind`. Shared crosshair drawn in the client over
  the lane stack.
- Nav: add a Timeline entry (icon e.g. `Activity`/`GanttChart`) to the app nav +
  the relevant hub.

## 6. Mobile implementation

- `app/(tabs)/more/timeline.tsx` + `lib/timeline.ts` (reads each stream via
  supabase-js, same shared shapers).
- Lanes rendered with `react-native-svg` (`Line/Path/Polyline/Rect/Circle`),
  fixed viewBox per lane like `projections.tsx`.
- Scrub via `react-native-gesture-handler` pan; readout header above the stack.
- Tablet-aware centered max-width via `useResponsive()`.
- `More` menu gains a Timeline row.

## 7. Calories-burned (resolved)

No store exists for energy expenditure (no column on `workouts`, no health-import
table yet). v1 does **not** fabricate a number: the Training lane shows sessions,
duration, type, and RPE only. When the Apple Health / Health Connect active-energy
import lands, a calories-burned series can be added to the Training lane as a real
source. (Decision: option **(a)+(c)**.)

## 8. Safety

- The timeline is a **read-only projection of user-entered data** — it emits no
  doses and no projections, so it sits largely outside the dose/projection safety
  surface.
- Labs values retain their **range-status flags for clinician discussion and are
  never interpreted/diagnosed**; the lab popover reuses the existing labs status
  treatment + disclaimer copy.
- Any compound rendered carries its existing evidence treatment; no new dose text
  is generated.
- `safety-reviewer` still runs over the labs + dose rendering paths before commit.
- No new user-scoped tables → schema-guardian N/A (unless we later add a SQL view;
  none planned for v1). All sources are already RLS'd.

## 9. Demo data

Extend `scripts/seed-demo.mjs` so the demo user's range is populated across every
lane (it already seeds weights, doses, food, workouts, labs, goal_metrics, and
purchases — verify each spans a meaningful window so the timeline reads well).

## 10. Gates

- `pnpm turbo run typecheck` → 16/16
- `pnpm test:timeline` → green (new pure-model harness)
- Vercel deploy READY (local `next build` is broken on this machine)
- `cd apps/mobile && npx expo export -p ios` clean
- Playwright overflow check at 390px on `/timeline`
- `safety-reviewer` on labs/dose paths → 0 blockers

## 11. Out of scope (v1)

- Calories-burned numbers (deferred to health-import active-energy, §7).
- Overlaying multiple metrics on a single y-axis (lanes stay separate).
- Editing/log-from-timeline (read-only; logging stays in existing surfaces).
- Annotations/notes on the timeline.
- Export of the timeline view (data export already covers the underlying rows).
