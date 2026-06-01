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
