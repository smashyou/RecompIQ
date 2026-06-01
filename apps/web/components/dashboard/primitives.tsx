import type { ReactNode } from "react";

// Dashboard card shell — ports the reference Card composition with real tokens.
export function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--r-lg)] border border-border bg-card p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-sans)] text-sm font-medium text-foreground">
          {title}
        </h2>
        {hint && (
          <span className="font-[family-name:var(--font-sans)] text-2xs uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            {hint}
          </span>
        )}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Big mono stat with a subordinate unit, matching the reference Stat treatment.
export function Stat({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className="font-[family-name:var(--font-mono)] text-stat font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
      {value}
      {unit && (
        <span className="ml-1 font-[family-name:var(--font-sans)] text-sm font-normal text-[var(--fg-subtle)]">
          {unit}
        </span>
      )}
    </p>
  );
}

// Inline area sparkline — ported from the reference Sparkline component.
export function Sparkline({
  points,
  color = "var(--primary)",
  h = 40,
}: {
  points: number[];
  color?: string;
  h?: number;
}) {
  if (points.length < 2) return null;
  const w = 240;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const ys = points.map(
    (v) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3,
  );
  const d = xs
    .map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${(ys[i] ?? 0).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: h }}
    >
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.08" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Conic-gradient macro ring — ported from the reference Ring component.
export function Ring({
  pct,
  rows,
}: {
  pct: number;
  rows: [label: string, value: string, color: string][];
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-[78px] w-[78px] flex-none place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--positive) 0 ${pct}%, var(--surface-3) ${pct}% 100%)`,
        }}
      >
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[var(--surface-1)] font-[family-name:var(--font-mono)] text-base font-medium tabular-nums text-foreground">
          {pct}%
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-baseline gap-2">
            <span
              className="h-2 w-2 rounded-[2px]"
              style={{ background: c }}
            />
            <span className="w-12 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
              {k}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-foreground">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
