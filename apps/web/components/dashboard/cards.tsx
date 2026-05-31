import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Droplet,
  Heart,
  Syringe,
} from "lucide-react";
import { buildProjection } from "@peptide/projections";
import type { EvidenceLevel } from "@peptide/shared";
import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { Card, Ring, Sparkline, Stat } from "./primitives";

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------
export function WeightCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { latestWeight, weightSeries, goal } = snapshot;
  if (!latestWeight) {
    return (
      <Card title="Weight">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          Log your first weigh-in to start tracking.
        </p>
      </Card>
    );
  }
  const start =
    goal?.start_weight_lb ?? weightSeries[0]?.value_lb ?? latestWeight.value_lb;
  const targetMid = goal
    ? (goal.goal_weight_lb_min + goal.goal_weight_lb_max) / 2
    : null;
  const lost = start - latestWeight.value_lb;
  const remaining =
    targetMid !== null ? Math.max(latestWeight.value_lb - targetMid, 0) : null;

  const recent7 = weightSeries.slice(-7);
  const first7 = recent7[0];
  const last7 = recent7[recent7.length - 1];
  const recentChange =
    recent7.length >= 2 && first7 && last7 ? first7.value_lb - last7.value_lb : 0;

  const spark = weightSeries.slice(-14).map((w) => w.value_lb);

  return (
    <Card title="Weight" hint={fmtDay(latestWeight.logged_at)}>
      <div className="flex items-baseline justify-between">
        <Stat value={latestWeight.value_lb.toFixed(1)} unit="lb" />
        <span
          className="font-[family-name:var(--font-mono)] text-[11.5px] tabular-nums"
          style={{
            color: recentChange > 0 ? "var(--positive)" : "var(--fg-subtle)",
          }}
        >
          7d {recentChange >= 0 ? "−" : "+"}
          {Math.abs(recentChange).toFixed(1)} lb
        </span>
      </div>
      <dl className="my-[14px] grid grid-cols-3 gap-2">
        {(
          [
            ["Start", start.toFixed(1)],
            ["Lost", lost.toFixed(1)],
            ["To target", remaining !== null ? remaining.toFixed(1) : "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="font-[family-name:var(--font-sans)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              {k}
            </dt>
            <dd className="mt-[3px] font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-foreground">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <Sparkline points={spark} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------
export function ProjectionCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { weightSeries, goal, latestWeight } = snapshot;
  if (!goal || !latestWeight) {
    return (
      <Card title="Projection" hint="ETA">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          Set a goal in onboarding to see ETA.
        </p>
      </Card>
    );
  }
  const projection = buildProjection({
    weights: weightSeries,
    startWeightLb: goal.start_weight_lb,
    goalWeightLbMin: goal.goal_weight_lb_min,
    goalWeightLbMax: goal.goal_weight_lb_max,
    timelineWeeks: goal.timeline_weeks,
  });
  if (!projection) {
    return (
      <Card title="Projection" hint="ETA">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          Log a few weigh-ins to start projecting.
        </p>
      </Card>
    );
  }

  const etaDate = projection.series.target.etaDate;
  const etaLabel = etaDate
    ? new Date(etaDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "—";

  // Build the mini multi-line chart from the real trajectories.
  const chart = buildProjectionPaths(projection);

  return (
    <Card title="Projection" hint={`${goal.timeline_weeks} weeks`}>
      <div className="flex items-baseline gap-2">
        <Stat value={etaLabel} />
        <span className="font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
          ETA · target band
        </span>
      </div>
      <svg
        viewBox="0 0 240 70"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 70, marginTop: 12 }}
      >
        <rect
          x="0"
          y={chart.bandY - 7}
          width="240"
          height="14"
          fill="var(--positive)"
          opacity="0.12"
        />
        <line
          x1="0"
          y1={chart.bandY}
          x2="240"
          y2={chart.bandY}
          stroke="var(--positive)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />
        <path
          d={chart.actual}
          fill="none"
          stroke="var(--fg)"
          strokeWidth="2"
        />
        <path
          d={chart.target}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d={chart.conservative}
          fill="none"
          stroke="var(--fg-subtle)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d={chart.aggressive}
          fill="none"
          stroke="var(--positive)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
      <div className="mt-2 flex gap-3">
        {(
          [
            ["Target", "var(--primary)"],
            ["Conserv.", "var(--fg-subtle)"],
            ["Aggr.", "var(--positive)"],
          ] as const
        ).map(([k, c]) => (
          <span
            key={k}
            className="flex items-center gap-[5px] font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]"
          >
            <span className="h-[2px] w-3" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

// Map the projection engine's lb series into normalized SVG paths.
function buildProjectionPaths(
  p: ReturnType<typeof buildProjection> & object,
) {
  const W = 240;
  const H = 70;
  const actualPts = p.sevenDayMA.slice(-12).map((d) => d.value_lb);
  const target = p.series.target.points.map((pt) => pt.lb);
  const conservative = p.series.conservative.points.map((pt) => pt.lb);
  const aggressive = p.series.aggressive.points.map((pt) => pt.lb);

  const allVals = [
    ...actualPts,
    ...target,
    ...conservative,
    ...aggressive,
    p.targetMidLb,
  ];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;
  const y = (v: number) => 4 + ((max - v) / span) * (H - 8);

  // Actual occupies the left ~half, forecasts the right half from the join.
  const splitX = W * 0.5;
  const actual = lineFromVals(actualPts, 0, splitX, y);
  const joinVal = actualPts[actualPts.length - 1] ?? p.currentWeightLb;
  const forecast = (vals: number[]) =>
    lineFromVals([joinVal, ...vals], splitX, W, y);

  return {
    bandY: y(p.targetMidLb),
    actual,
    target: forecast(sampleForecast(target)),
    conservative: forecast(sampleForecast(conservative)),
    aggressive: forecast(sampleForecast(aggressive)),
  };
}

// Forecast lines are long; sample to a handful of points for a clean mini-chart.
function sampleForecast(vals: number[]): number[] {
  const horizon = vals.slice(0, Math.min(vals.length, 27));
  const step = Math.max(1, Math.floor(horizon.length / 4));
  const out: number[] = [];
  for (let i = step; i < horizon.length; i += step) {
    const v = horizon[i];
    if (v !== undefined) out.push(v);
  }
  const last = horizon[horizon.length - 1];
  if (last !== undefined && out[out.length - 1] !== last) out.push(last);
  return out;
}

function lineFromVals(
  vals: number[],
  x0: number,
  x1: number,
  y: (v: number) => number,
): string {
  if (vals.length === 0) return "";
  if (vals.length === 1) {
    const yy = y(vals[0] ?? 0).toFixed(1);
    return `M${x0.toFixed(1)},${yy} L${x1.toFixed(1)},${yy}`;
  }
  return vals
    .map((v, i) => {
      const x = x0 + (i / (vals.length - 1)) * (x1 - x0);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y(v).toFixed(1)}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------
export function VitalsCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const v = snapshot.latestVital;
  if (!v) {
    return (
      <Card title="Vitals">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No vitals logged yet.
        </p>
      </Card>
    );
  }

  const bpHigh =
    (v.bp_systolic !== null && v.bp_systolic >= 130) ||
    (v.bp_diastolic !== null && v.bp_diastolic >= 80);
  const glucoseHigh = v.glucose_mgdl !== null && v.glucose_mgdl >= 126;
  const hrHigh = v.hr !== null && v.hr >= 100;

  const rows: [
    label: string,
    value: string,
    unit: string,
    Icon: typeof Heart,
    warn: boolean,
  ][] = [
    [
      "Blood pressure",
      v.bp_systolic !== null && v.bp_diastolic !== null
        ? `${v.bp_systolic} / ${v.bp_diastolic}`
        : "—",
      "mmHg",
      Heart,
      bpHigh,
    ],
    [
      "Fasting glucose",
      v.glucose_mgdl !== null ? v.glucose_mgdl.toFixed(0) : "—",
      "mg/dL",
      Droplet,
      glucoseHigh,
    ],
    ["Resting HR", v.hr !== null ? String(v.hr) : "—", "bpm", Activity, hrHigh],
  ];

  return (
    <Card title="Vitals" hint={fmtDay(v.logged_at)}>
      <div className="flex flex-col gap-3">
        {rows.map(([k, val, u, Icon, warn]) => (
          <div key={k} className="flex items-center gap-[10px]">
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] bg-[var(--surface-2)] text-[var(--fg-muted)]">
              <Icon size={15} />
            </span>
            <span className="flex-1 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
              {k}
            </span>
            <span
              className="font-[family-name:var(--font-mono)] text-[14px] tabular-nums"
              style={{ color: warn ? "var(--warn)" : "var(--fg)" }}
            >
              {val}
              <span className="ml-[3px] text-[10px] text-[var(--fg-subtle)]">
                {u}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------
export function MacrosCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const m = snapshot.macrosToday;
  const logged =
    m.protein_g > 0 || m.carbs_g > 0 || m.fat_g > 0 || m.calories_kcal > 0;
  if (!logged) {
    return (
      <Card title="Today's macros" hint="Protein-first">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No food logged today. Add a meal in{" "}
          <Link href="/food" className="underline-offset-2 hover:underline">
            /food
          </Link>
          .
        </p>
      </Card>
    );
  }

  const proteinMax = snapshot.goal?.protein_target_g_max ?? null;
  const pct =
    proteinMax && proteinMax > 0
      ? Math.min(100, Math.round((m.protein_g / proteinMax) * 100))
      : Math.min(100, Math.round((m.protein_g / 175) * 100));

  const proteinVal =
    proteinMax !== null
      ? `${Math.round(m.protein_g)} / ${proteinMax}g`
      : `${Math.round(m.protein_g)}g`;

  return (
    <Card title="Today's macros" hint="Protein-first">
      <Ring
        pct={pct}
        rows={[
          ["Protein", proteinVal, "var(--positive)"],
          ["Carbs", `${Math.round(m.carbs_g)}g`, "var(--fg)"],
          ["Fat", `${Math.round(m.fat_g)}g`, "var(--fg)"],
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Peptide adherence
// ---------------------------------------------------------------------------
export function AdherenceCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { recentDoses, hasActiveStack, activeStack } = snapshot;
  if (!hasActiveStack) {
    return (
      <Card title="Peptide adherence" hint="14 days">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No active stack. Create one in{" "}
          <Link
            href="/peptides/stacks/new"
            className="underline-offset-2 hover:underline"
          >
            /peptides
          </Link>
          .
        </p>
      </Card>
    );
  }

  // 14-day cells: 1 = all taken, 2 = partial/mixed, 0 = nothing/skipped.
  const cells: number[] = [];
  let taken = 0;
  let total = 0;
  let missed = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayDoses = recentDoses.filter((x) => x.taken_at.slice(0, 10) === iso);
    if (dayDoses.length === 0) {
      cells.push(0);
      continue;
    }
    const dayTaken = dayDoses.filter((x) => x.adherence === "taken").length;
    taken += dayTaken;
    total += dayDoses.length;
    if (dayTaken === dayDoses.length) cells.push(1);
    else if (dayTaken > 0) cells.push(2);
    else {
      cells.push(0);
      missed += 1;
    }
  }
  const pct = total > 0 ? Math.round((taken / total) * 100) : null;

  if (recentDoses.length === 0) {
    return (
      <Card title="Peptide adherence" hint="14 days">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No doses logged yet —{" "}
          <Link
            href="/peptides/dose-log"
            className="underline-offset-2 hover:underline"
          >
            log one
          </Link>
          .
        </p>
      </Card>
    );
  }

  const names = (activeStack?.items ?? []).slice(0, 2).map((i) => i.name);
  const caption =
    names.length > 0
      ? `${names.join(" + ")}${
          (activeStack?.items.length ?? 0) > 2 ? " · KLOW" : ""
        }${missed > 0 ? ` · ${missed} missed` : ""}`
      : missed > 0
        ? `${missed} missed day${missed === 1 ? "" : "s"}`
        : "On track";

  return (
    <Card title="Peptide adherence" hint="14 days">
      <Stat value={pct !== null ? String(pct) : "—"} unit="%" />
      <div className="mt-[14px] grid grid-cols-7 gap-1">
        {cells.map((s, i) => (
          <span
            key={`day-${i}`}
            className="h-4 rounded-[3px]"
            style={{
              background:
                s === 1
                  ? "var(--positive)"
                  : s === 2
                    ? "var(--positive-dim)"
                    : "var(--surface-3)",
            }}
          />
        ))}
      </div>
      <p className="mt-[10px] font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
        {caption}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coach insight
// ---------------------------------------------------------------------------
export function CoachInsightCard({ insight }: { insight: string }) {
  return (
    <Card title="Coach insight" hint="AI">
      <div className="flex gap-[10px]">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-[linear-gradient(150deg,var(--primary),var(--positive))] text-[var(--primary-foreground)]">
          <Activity size={15} />
        </span>
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
          {insight}
        </p>
      </div>
      <Link
        href="/coach"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--r-sm)] border border-border bg-transparent px-3 py-2 font-[family-name:var(--font-sans)] text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
      >
        Open coach
        <ChevronRight size={14} />
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Active protocol
// ---------------------------------------------------------------------------
export function ActiveProtocolCard({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const stack = snapshot.activeStack;
  if (!stack || stack.items.length === 0) {
    return (
      <Card title="Active protocol">
        <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No active stack. Build one from the compounds you and your clinician
          have decided on in{" "}
          <Link href="/peptides" className="underline-offset-2 hover:underline">
            /peptides
          </Link>
          .
        </p>
        <div className="mt-[14px]">
          <SafetyDisclaimer variant="compact" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Active protocol" hint={stack.phase ?? undefined}>
      <div className="flex flex-col">
        {stack.items.map((r, i) => (
          <Link
            key={r.slug}
            href="/peptides"
            className="flex items-center gap-3 py-3"
            style={{ borderTop: i ? "1px solid var(--border)" : "none" }}
          >
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[8px] bg-[var(--surface-2)] text-[var(--primary)]">
              <Syringe size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-foreground">
                {r.name}
              </div>
              {r.descriptor && (
                <div className="truncate font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                  {r.descriptor}
                </div>
              )}
            </div>
            <EvidenceBadge
              level={r.evidence_level as EvidenceLevel}
              fdaApproved={r.fda_approved}
            />
            <ChevronRight size={16} className="text-[var(--fg-subtle)]" />
          </Link>
        ))}
      </div>
      <div className="mt-[14px]">
        <SafetyDisclaimer variant="compact" />
      </div>
    </Card>
  );
}
