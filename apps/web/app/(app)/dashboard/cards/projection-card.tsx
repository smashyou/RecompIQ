import { naiveProjection, type DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

export function ProjectionCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { weightSeries, goal, latestWeight } = snapshot;
  if (!goal || !latestWeight) {
    return (
      <Card title="Projection" hint="ETA">
        <Empty>Set a goal in onboarding to see ETA.</Empty>
      </Card>
    );
  }
  const { etaWeeks, weeklyLossLb } = naiveProjection(
    weightSeries,
    goal.goal_weight_lb_min,
    goal.goal_weight_lb_max,
  );
  const etaDate =
    etaWeeks !== null
      ? new Date(Date.now() + etaWeeks * 7 * 24 * 3600 * 1000).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <Card title="Projection" hint="naive linear">
      {etaWeeks === null ? (
        <Empty>Need more weigh-ins (≥4) or a downward trend to project.</Empty>
      ) : (
        <div className="space-y-3">
          <p className="text-3xl font-semibold tabular-nums">
            ~{etaWeeks}
            <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">
              weeks to target band
            </span>
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-[var(--color-muted-foreground)]">Weekly trend</dt>
              <dd className="tabular-nums">
                −{weeklyLossLb !== null ? weeklyLossLb.toFixed(2) : "—"} lb
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted-foreground)]">Est. arrival</dt>
              <dd className="tabular-nums">{etaDate ?? "—"}</dd>
            </div>
          </dl>
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-2 text-[10px] leading-relaxed text-[var(--color-muted-foreground)]">
            Projection, not prediction. Real progress is non-linear. Curve-based modeling lands in
            Phase 5.
          </p>
        </div>
      )}
    </Card>
  );
}
