"use client";

import type { SyringeModel } from "@peptide/peptides";

// Pure presentational SVG of an insulin syringe barrel with tick marks and a
// fill line at the draw volume. Driven entirely by the syringeModel() output.
export function SyringeVisual({ model, unitsLabel }: { model: SyringeModel; unitsLabel: string }) {
  const W = 320;
  const H = 96;
  const barrelX = 28;
  const barrelW = 232;
  const barrelY = 30;
  const barrelH = 30;
  const plungerW = 36;

  const fillW = barrelW * model.fillFraction;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Syringe filled to ${model.fillUnits.toFixed(1)} units of ${model.capacityUnits}`}
      >
        {/* needle */}
        <line
          x1={barrelX + barrelW}
          y1={barrelY + barrelH / 2}
          x2={W - 2}
          y2={barrelY + barrelH / 2}
          stroke="var(--color-muted-foreground)"
          strokeWidth={2}
        />
        {/* plunger flange (left) */}
        <rect
          x={2}
          y={barrelY - 6}
          width={plungerW * 0.4}
          height={barrelH + 12}
          rx={2}
          fill="var(--color-muted)"
          stroke="var(--color-border)"
        />
        {/* barrel outline */}
        <rect
          x={barrelX}
          y={barrelY}
          width={barrelW}
          height={barrelH}
          rx={4}
          fill="var(--color-card)"
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
        {/* fill */}
        <rect
          x={barrelX}
          y={barrelY}
          width={fillW}
          height={barrelH}
          rx={4}
          fill={model.overfilled ? "var(--color-destructive)" : "var(--color-primary)"}
          opacity={0.28}
        />
        {/* fill leading edge */}
        <line
          x1={barrelX + fillW}
          y1={barrelY - 4}
          x2={barrelX + fillW}
          y2={barrelY + barrelH + 4}
          stroke={model.overfilled ? "var(--color-destructive)" : "var(--color-primary)"}
          strokeWidth={2}
        />
        {/* ticks */}
        {model.ticks.map((t, i) => {
          const x = barrelX + barrelW * (t.units / model.capacityUnits);
          const len = t.major ? 10 : 5;
          return (
            <g key={i}>
              <line
                x1={x}
                y1={barrelY}
                x2={x}
                y2={barrelY + len}
                stroke="var(--color-muted-foreground)"
                strokeWidth={t.major ? 1.2 : 0.6}
              />
              {t.major && (
                <text
                  x={x}
                  y={barrelY - 4}
                  textAnchor="middle"
                  fontSize={7}
                  fill="var(--color-muted-foreground)"
                >
                  {t.units}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        Draw to{" "}
        <span
          className={`font-semibold tabular-nums ${
            model.overfilled ? "text-[var(--color-destructive)]" : "text-[var(--color-primary)]"
          }`}
        >
          {model.fillUnits.toFixed(1)} {unitsLabel}
        </span>{" "}
        on a {model.capacityUnits}-unit barrel
        {model.overfilled && " — exceeds barrel capacity; use a larger syringe or split the dose"}
      </p>
    </div>
  );
}
