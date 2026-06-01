import { METRIC_BY_KEY } from "../goals/metrics";
import { effectiveRange, rangeStatus } from "../labs/catalog";
import { buildTimeScale, toMs, type TimeScale } from "./scale";
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
  if (!Number.isFinite(span) || span <= 0) return 0.5;
  return (v - min) / span;
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
  // Coerce each row's value once; drop non-finite rows so they can't poison the domain.
  const sorted = rows
    .map((r) => ({ ...r, n: Number(r.value_lb) }))
    .filter((r) => Number.isFinite(r.n))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const vals = sorted.map((r) => r.n);
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const line: LinePoint[] = sorted.map((r) => ({
    frac: scale.frac(toMs(r.logged_at)),
    v: r.n,
    vFrac: min !== null && max !== null ? vFracOf(r.n, min, max) : 0.5,
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
    summary: first && last ? `${num(first.n, 1)}→${num(last.n, 1)} lb` : "—",
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
    const cal = Number(r.calories_kcal);
    const pro = Number(r.protein_g);
    // Skip non-finite values so one bad row can't make the day's total "NaN".
    if (Number.isFinite(cal)) calByDay.set(day, (calByDay.get(day) ?? 0) + cal);
    if (Number.isFinite(pro)) proByDay.set(day, (proByDay.get(day) ?? 0) + pro);
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
  for (const [key, rawArr] of byKey) {
    // Coerce each row's value once; drop non-finite rows so they can't poison the domain.
    const arr = rawArr
      .map((r) => ({ ...r, n: Number(r.value) }))
      .filter((r) => Number.isFinite(r.n))
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
    if (!arr.length) continue;
    const def = METRIC_BY_KEY[key];
    const vals = arr.map((r) => r.n);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const line: LinePoint[] = arr.map((r) => ({
      frac: scale.frac(toMs(r.logged_at)),
      v: r.n,
      vFrac: vFracOf(r.n, min, max),
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
      summary: first && last ? `${num(first.n, 1)}→${num(last.n, 1)}` : "—",
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
      const st = rangeStatus(r.value, range.low, range.high);
      // Flag ONLY out-of-range. "unknown" (no reference at all) is not a flag —
      // we have nothing to discuss against, and must never imply otherwise.
      return st === "low" || st === "high";
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
        const st = rangeStatus(r.value, range.low, range.high);
        return st === "low" || st === "high";
      });
      return `${parts.join(", ")}${anyFlag ? " — discuss flags with a clinician" : ""}`;
    },
  };
}

export function shapeSpendLane(rows: PurchaseRow[], scale: TimeScale): TimelineLane {
  // Skip non-finite prices so one bad row can't make the total "$NaN".
  const finite = (v: number) => (Number.isFinite(v) ? v : 0);
  const total = rows.reduce((a, r) => a + finite(Number(r.price_usd)), 0);
  const events: EventDot[] = rows.map((r) => ({
    frac: scale.frac(toMs(r.purchased_on)),
    dateISO: r.purchased_on,
    label: `$${num(finite(Number(r.price_usd)))}`,
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
      return day.length ? `$${num(day.reduce((a, r) => a + finite(Number(r.price_usd)), 0))}` : null;
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
