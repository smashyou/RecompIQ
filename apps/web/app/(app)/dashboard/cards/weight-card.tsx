import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";
import { WeightSparkline } from "./weight-sparkline";

export function WeightCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { latestWeight, weightSeries, goal } = snapshot;
  if (!latestWeight) {
    return (
      <Card title="Weight">
        <Empty>Log your first weigh-in to start tracking.</Empty>
      </Card>
    );
  }
  const start = goal?.start_weight_lb ?? weightSeries[0]?.value_lb ?? latestWeight.value_lb;
  const targetMid = goal ? (goal.goal_weight_lb_min + goal.goal_weight_lb_max) / 2 : null;
  const lost = start - latestWeight.value_lb;
  const remaining = targetMid !== null ? Math.max(latestWeight.value_lb - targetMid, 0) : null;

  const recent7 = weightSeries.slice(-7);
  const recentChange =
    recent7.length >= 2 ? recent7[0]!.value_lb - recent7[recent7.length - 1]!.value_lb : 0;

  return (
    <Card
      title="Weight"
      hint={new Date(latestWeight.logged_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-semibold tabular-nums">
          {latestWeight.value_lb.toFixed(1)}
          <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">lb</span>
        </p>
        <p
          className={`text-xs tabular-nums ${
            recentChange > 0 ? "text-[var(--color-accent)]" : "text-[var(--color-muted-foreground)]"
          }`}
        >
          7d: {recentChange >= 0 ? "−" : "+"}
          {Math.abs(recentChange).toFixed(1)} lb
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-[var(--color-muted-foreground)]">Start</dt>
          <dd className="tabular-nums">{start.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted-foreground)]">Lost</dt>
          <dd className="tabular-nums">{lost.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted-foreground)]">To target</dt>
          <dd className="tabular-nums">{remaining !== null ? remaining.toFixed(1) : "—"}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <WeightSparkline data={weightSeries.slice(-14)} />
      </div>
    </Card>
  );
}
