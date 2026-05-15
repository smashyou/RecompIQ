// Weight projection engine — pure functions, no IO.
// Inputs: weight series + goal. Outputs: 3 trajectory lines, 7-day MA over
// actual data, ETA per trajectory, adherence vs. target.
//
// Modeled as linear slopes for MVP. Curve-fit (asymptotic toward target,
// plateau-aware) is a future enhancement.

export interface WeightPoint {
  /** ISO date string or YYYY-MM-DD. */
  logged_at: string;
  /** Pounds. */
  value_lb: number;
}

export interface ProjectionPoint {
  weekIndex: number;
  date: string;
  lb: number;
}

export interface ProjectionSeries {
  rate: "conservative" | "target" | "aggressive";
  lbsPerWeek: number;
  points: ProjectionPoint[];
  etaWeeks: number | null;
  etaDate: string | null;
}

export interface ProjectionResult {
  startWeightLb: number;
  currentWeightLb: number;
  targetMidLb: number;
  targetMinLb: number;
  targetMaxLb: number;
  weeklyTrendLb: number | null; // observed recent slope
  series: {
    conservative: ProjectionSeries;
    target: ProjectionSeries;
    aggressive: ProjectionSeries;
  };
  sevenDayMA: WeightPoint[];
  adherence: AdherenceLabel;
}

export type AdherenceLabel =
  | "ahead"
  | "on-target"
  | "behind"
  | "stalled"
  | "insufficient-data";

// Rounded to two decimals for stable rendering / hashing.
function round2(n: number) {
  return Number(n.toFixed(2));
}
function addDaysIso(d: Date, days: number): string {
  const x = new Date(d);
  x.setDate(d.getDate() + days);
  return x.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Trend over recent series (default: trailing 14 days)
// ---------------------------------------------------------------------------
export function currentTrendLbsPerWeek(
  series: WeightPoint[],
  windowDays = 14,
): number | null {
  if (series.length < 2) return null;
  const sorted = [...series].sort(
    (a, b) => +new Date(a.logged_at) - +new Date(b.logged_at),
  );
  const last = sorted[sorted.length - 1]!;
  const lastTime = +new Date(last.logged_at);
  const cutoff = lastTime - windowDays * 86_400_000;
  const window = sorted.filter((p) => +new Date(p.logged_at) >= cutoff);
  if (window.length < 2) return null;
  const first = window[0]!;
  const daySpan =
    (+new Date(last.logged_at) - +new Date(first.logged_at)) / 86_400_000;
  if (daySpan < 1) return null;
  const delta = first.value_lb - last.value_lb; // positive when losing
  return round2((delta / daySpan) * 7);
}

// ---------------------------------------------------------------------------
// 7-day moving average over actual weights
// ---------------------------------------------------------------------------
export function sevenDayMA(series: WeightPoint[]): WeightPoint[] {
  if (series.length === 0) return [];
  const sorted = [...series].sort(
    (a, b) => +new Date(a.logged_at) - +new Date(b.logged_at),
  );
  const out: WeightPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const center = sorted[i]!;
    const centerTime = +new Date(center.logged_at);
    const window = sorted.filter((p) => {
      const t = +new Date(p.logged_at);
      return t <= centerTime && t >= centerTime - 6 * 86_400_000;
    });
    const avg =
      window.reduce((acc, p) => acc + p.value_lb, 0) / Math.max(1, window.length);
    out.push({ logged_at: center.logged_at, value_lb: round2(avg) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// ETA to a target weight at a given weekly loss rate
// ---------------------------------------------------------------------------
export function etaForRate(
  currentWeightLb: number,
  targetWeightLb: number,
  lbsPerWeek: number,
): number | null {
  if (lbsPerWeek <= 0) return null;
  if (currentWeightLb <= targetWeightLb) return 0;
  return Math.ceil((currentWeightLb - targetWeightLb) / lbsPerWeek);
}

// ---------------------------------------------------------------------------
// Build a linear forward projection at a given weekly rate
// ---------------------------------------------------------------------------
function lineFromRate(
  startWeightLb: number,
  startDate: Date,
  lbsPerWeek: number,
  targetMidLb: number,
  weeks: number,
  rate: ProjectionSeries["rate"],
): ProjectionSeries {
  const points: ProjectionPoint[] = [];
  for (let w = 0; w <= weeks; w++) {
    const lb = Math.max(targetMidLb, startWeightLb - lbsPerWeek * w);
    points.push({ weekIndex: w, date: addDaysIso(startDate, w * 7), lb: round2(lb) });
    if (lb <= targetMidLb && w < weeks) {
      // Trajectory has reached the target band — clamp remaining points.
      // We still produce them so chart x-axis stays aligned across lines.
    }
  }
  const etaWeeks = etaForRate(startWeightLb, targetMidLb, lbsPerWeek);
  const etaDate =
    etaWeeks !== null
      ? addDaysIso(startDate, etaWeeks * 7)
      : null;
  return { rate, lbsPerWeek: round2(lbsPerWeek), points, etaWeeks, etaDate };
}

// ---------------------------------------------------------------------------
// Derive 3 weekly rates from goal:
//   target      = (start - target_mid) / timeline_weeks   (matches the goal)
//   conservative = target * 0.6
//   aggressive   = target * 1.15
// Each rate is clamped to a sane band (0.25 – 3.5 lb/week).
// ---------------------------------------------------------------------------
export interface DeriveRatesInput {
  startWeightLb: number;
  targetMidLb: number;
  timelineWeeks: number;
}

export interface DerivedRates {
  conservative: number;
  target: number;
  aggressive: number;
}

const RATE_MIN = 0.25;
const RATE_MAX = 3.5;

export function deriveRates(input: DeriveRatesInput): DerivedRates {
  const delta = Math.max(0, input.startWeightLb - input.targetMidLb);
  const target =
    input.timelineWeeks > 0 ? delta / input.timelineWeeks : 0;
  const clamp = (n: number) =>
    round2(Math.min(RATE_MAX, Math.max(RATE_MIN, n)));
  return {
    conservative: clamp(target * 0.6),
    target: clamp(target),
    aggressive: clamp(target * 1.15),
  };
}

// ---------------------------------------------------------------------------
// Adherence label: where is the user's trend vs. the conservative/target/aggressive bands?
// ---------------------------------------------------------------------------
export function adherenceLabel(
  weeklyTrend: number | null,
  rates: DerivedRates,
): AdherenceLabel {
  if (weeklyTrend === null) return "insufficient-data";
  if (weeklyTrend <= 0) return "stalled";
  if (weeklyTrend >= rates.aggressive) return "ahead";
  if (weeklyTrend >= rates.target) return "on-target";
  if (weeklyTrend >= rates.conservative) return "behind";
  return "stalled";
}

// ---------------------------------------------------------------------------
// Top-level: build the full projection result
// ---------------------------------------------------------------------------
export interface BuildProjectionInput {
  weights: WeightPoint[];
  startWeightLb: number;
  goalWeightLbMin: number;
  goalWeightLbMax: number;
  timelineWeeks: number;
}

export function buildProjection(input: BuildProjectionInput): ProjectionResult | null {
  const sortedActual = [...input.weights].sort(
    (a, b) => +new Date(a.logged_at) - +new Date(b.logged_at),
  );
  const latest = sortedActual[sortedActual.length - 1];
  if (!latest) return null;

  const targetMidLb = round2((input.goalWeightLbMin + input.goalWeightLbMax) / 2);
  const rates = deriveRates({
    startWeightLb: input.startWeightLb,
    targetMidLb,
    timelineWeeks: input.timelineWeeks,
  });
  const trend = currentTrendLbsPerWeek(sortedActual);
  const startDate = new Date(latest.logged_at);
  const projectionWeeks = Math.max(8, Math.min(52, input.timelineWeeks + 8));

  return {
    startWeightLb: round2(input.startWeightLb),
    currentWeightLb: round2(latest.value_lb),
    targetMidLb,
    targetMinLb: round2(input.goalWeightLbMin),
    targetMaxLb: round2(input.goalWeightLbMax),
    weeklyTrendLb: trend,
    series: {
      conservative: lineFromRate(
        latest.value_lb,
        startDate,
        rates.conservative,
        targetMidLb,
        projectionWeeks,
        "conservative",
      ),
      target: lineFromRate(
        latest.value_lb,
        startDate,
        rates.target,
        targetMidLb,
        projectionWeeks,
        "target",
      ),
      aggressive: lineFromRate(
        latest.value_lb,
        startDate,
        rates.aggressive,
        targetMidLb,
        projectionWeeks,
        "aggressive",
      ),
    },
    sevenDayMA: sevenDayMA(sortedActual),
    adherence: adherenceLabel(trend, rates),
  };
}

// Backwards-compat: the dashboard's first-pass helper used a different name.
// Keep a shim so we don't break imports while migrating call sites.
export interface ProjectionInput {
  startWeightLb: number;
  goalWeightLbMin: number;
  goalWeightLbMax: number;
  timelineWeeks: number;
  conservativeLossLbPerWeek?: number;
  targetLossLbPerWeek?: number;
  aggressiveLossLbPerWeek?: number;
}

export function projectWeight(_: ProjectionInput) {
  throw new Error("projectWeight is deprecated — use buildProjection(...) instead");
}
