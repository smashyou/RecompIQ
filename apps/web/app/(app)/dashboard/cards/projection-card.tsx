import Link from "next/link";
import { buildProjection } from "@peptide/projections";
import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

const ADHERENCE: Record<
  string,
  { label: string; tone: "good" | "warn" | "neutral" }
> = {
  ahead: { label: "Ahead", tone: "good" },
  "on-target": { label: "On target", tone: "good" },
  behind: { label: "Behind", tone: "warn" },
  stalled: { label: "Stalled", tone: "warn" },
  "insufficient-data": { label: "Need data", tone: "neutral" },
};

export function ProjectionCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { weightSeries, goal, latestWeight } = snapshot;
  if (!goal || !latestWeight) {
    return (
      <Card title="Projection" hint="ETA">
        <Empty>Set a goal in onboarding to see ETA.</Empty>
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
        <Empty>Log a few weigh-ins to start projecting.</Empty>
      </Card>
    );
  }

  const target = projection.series.target;
  const adherence = ADHERENCE[projection.adherence]!;
  const trend = projection.weeklyTrendLb;

  return (
    <Card title="Projection" hint={`Target ${target.lbsPerWeek} lb/wk`}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            {target.etaWeeks !== null ? `~${target.etaWeeks}` : "—"}
            <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">
              wk to target
            </span>
          </p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              adherence.tone === "good"
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : adherence.tone === "warn"
                  ? "border-[var(--color-destructive)] text-[var(--color-destructive)]"
                  : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"
            }`}
          >
            {adherence.label}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-[var(--color-muted-foreground)]">Trend (14d)</dt>
            <dd className="tabular-nums">
              {trend !== null ? `−${trend.toFixed(2)} lb/wk` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted-foreground)]">Target ETA</dt>
            <dd className="tabular-nums">
              {target.etaDate
                ? new Date(target.etaDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
        <Link
          href="/projections"
          className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline"
        >
          See full chart →
        </Link>
      </div>
    </Card>
  );
}
