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
