"use client";

import type { SyringeModel } from "@peptide/peptides/reconstitution";

// Web SVG port of the mobile Syringe (apps/mobile/components/peptides/Syringe.tsx).
// Driven entirely by the pure-TS syringeModel() tick data — same proportions:
// a horizontal barrel with minor/major ticks and a plunger line at the draw
// level. Colors come from CSS-var tokens so it tracks light/dark themes.
const VB_W = 320;
const VB_H = 96;
const X0 = 16;
const BAR_W = 272;
const BAR_Y = 30;
const BAR_H = 40;

export function Syringe({ model }: { model: SyringeModel }) {
  const fillColor = model.overfilled ? "var(--danger)" : "var(--primary)";
  const fillW = BAR_W * model.fillFraction;
  const cap = model.capacityUnits || 1;
  const majorTicks = model.ticks.filter((t) => t.major);

  return (
    <svg
      width="100%"
      height={120}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Syringe drawn to ${model.fillUnits.toFixed(1)} of ${model.capacityUnits} units`}
    >
      {/* barrel */}
      <rect
        x={X0}
        y={BAR_Y}
        width={BAR_W}
        height={BAR_H}
        rx={8}
        fill="var(--surface-1)"
        stroke="var(--border)"
        strokeWidth={1.5}
      />
      {/* fill */}
      <rect x={X0} y={BAR_Y} width={fillW} height={BAR_H} rx={8} fill={fillColor} opacity={0.35} />

      {/* ticks */}
      {model.ticks.map((t, i) => {
        const x = X0 + (t.units / cap) * BAR_W;
        const top = t.major ? 16 : 22;
        return (
          <line
            key={i}
            x1={x}
            y1={top}
            x2={x}
            y2={BAR_Y}
            stroke="var(--fg-subtle)"
            strokeWidth={t.major ? 1.2 : 0.6}
          />
        );
      })}
      {majorTicks.map((t, i) => {
        const x = X0 + (t.units / cap) * BAR_W;
        return (
          <text
            key={`l${i}`}
            x={x}
            y={12}
            fontSize={8}
            fill="var(--fg-subtle)"
            textAnchor="middle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {t.units}
          </text>
        );
      })}

      {/* plunger / draw level */}
      <line
        x1={X0 + fillW}
        y1={BAR_Y - 4}
        x2={X0 + fillW}
        y2={BAR_Y + BAR_H + 4}
        stroke={fillColor}
        strokeWidth={2.5}
      />
    </svg>
  );
}
