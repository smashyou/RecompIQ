// Generalized, metric-agnostic trend + ILLUSTRATIVE projection (PRD §6).
// Pure functions. Works on any {date, value} series (skin self-rating, lean
// mass, circumference, etc). A projection line is drawn ONLY when a
// literature-derived expected rate is supplied — otherwise trend-only. Every
// projected line is illustrative, not a predicted outcome.

export interface MetricPoint {
  date: string; // ISO or YYYY-MM-DD
  value: number;
}

export interface MetricProjectionInput {
  /** Higher value = better outcome (skin, muscle) vs lower = better (waist, pain). */
  higherIsBetter: boolean;
  /** Literature-derived expected improvement magnitude per week (metric units),
   *  graded. null = no projection line (trend only). Always positive magnitude. */
  expectedRatePerWeek: number | null;
  evidenceLevel?: string | null;
  horizonWeeks?: number; // default 12
  /** Optional clamp for bounded metrics (ratings 0–10 etc). */
  clampMin?: number;
  clampMax?: number;
}

export interface MetricProjectionSeries {
  rate: "conservative" | "target" | "aggressive";
  perWeek: number; // signed (toward improvement)
  points: { weekIndex: number; date: string; value: number }[];
}

export interface MetricProjectionResult {
  current: number | null;
  /** Signed observed change per week (positive = value increasing). */
  observedPerWeek: number | null;
  ma: MetricPoint[];
  projection: {
    conservative: MetricProjectionSeries;
    target: MetricProjectionSeries;
    aggressive: MetricProjectionSeries;
  } | null;
  illustrative: boolean;
}

const RATE_MULTIPLIER = { conservative: 0.6, target: 1.0, aggressive: 1.15 } as const;

function round2(n: number) {
  return Number(n.toFixed(2));
}
function sortByDate(series: MetricPoint[]): MetricPoint[] {
  return [...series].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Signed change per week over a trailing window (positive = value increasing). */
export function observedPerWeek(series: MetricPoint[], windowDays = 21): number | null {
  if (series.length < 2) return null;
  const s = sortByDate(series);
  const last = s[s.length - 1]!;
  const cutoff = +new Date(last.date) - windowDays * 86_400_000;
  const win = s.filter((p) => +new Date(p.date) >= cutoff);
  if (win.length < 2) return null;
  const first = win[0]!;
  const daySpan = (+new Date(last.date) - +new Date(first.date)) / 86_400_000;
  if (daySpan < 1) return null;
  return round2(((last.value - first.value) / daySpan) * 7);
}

/** 7-day trailing moving average over the series. */
export function metricMA(series: MetricPoint[]): MetricPoint[] {
  if (series.length === 0) return [];
  const s = sortByDate(series);
  return s.map((center) => {
    const ct = +new Date(center.date);
    const win = s.filter((p) => {
      const t = +new Date(p.date);
      return t <= ct && t >= ct - 6 * 86_400_000;
    });
    const avg = win.reduce((acc, p) => acc + p.value, 0) / Math.max(1, win.length);
    return { date: center.date, value: round2(avg) };
  });
}

export function buildMetricProjection(
  series: MetricPoint[],
  input: MetricProjectionInput,
): MetricProjectionResult {
  const s = sortByDate(series);
  const current = s.length ? s[s.length - 1]!.value : null;
  const obs = observedPerWeek(series);
  const ma = metricMA(series);

  if (current === null || input.expectedRatePerWeek === null || input.expectedRatePerWeek <= 0) {
    return { current, observedPerWeek: obs, ma, projection: null, illustrative: false };
  }

  const horizon = input.horizonWeeks ?? 12;
  const sign = input.higherIsBetter ? 1 : -1;
  const startDate = s[s.length - 1]!.date;
  const clamp = (v: number) => {
    let x = v;
    if (input.clampMin !== undefined) x = Math.max(input.clampMin, x);
    if (input.clampMax !== undefined) x = Math.min(input.clampMax, x);
    return round2(x);
  };

  const make = (rate: "conservative" | "target" | "aggressive"): MetricProjectionSeries => {
    const perWeek = sign * input.expectedRatePerWeek! * RATE_MULTIPLIER[rate];
    const points = [];
    for (let w = 0; w <= horizon; w++) {
      points.push({ weekIndex: w, date: addDaysIso(startDate, w * 7), value: clamp(current + perWeek * w) });
    }
    return { rate, perWeek: round2(perWeek), points };
  };

  return {
    current,
    observedPerWeek: obs,
    ma,
    projection: { conservative: make("conservative"), target: make("target"), aggressive: make("aggressive") },
    illustrative: true,
  };
}
