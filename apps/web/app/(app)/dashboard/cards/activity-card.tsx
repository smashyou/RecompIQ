import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

export function ActivityCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { todaySteps, todaySleepMin } = snapshot;
  if (todaySteps === null && todaySleepMin === null) {
    return (
      <Card title="Today's activity">
        <Empty>No steps or sleep logged yet today.</Empty>
      </Card>
    );
  }
  const hrs = todaySleepMin ? Math.floor(todaySleepMin / 60) : null;
  const mins = todaySleepMin ? todaySleepMin % 60 : null;
  return (
    <Card title="Today's activity" hint="from logs">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Steps</dt>
          <dd className="tabular-nums">{todaySteps?.toLocaleString() ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Sleep</dt>
          <dd className="tabular-nums">{hrs !== null ? `${hrs}h ${mins}m` : "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}
