import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

export function VitalsCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const v = snapshot.latestVital;
  if (!v) {
    return (
      <Card title="Vitals">
        <Empty>No vitals logged yet.</Empty>
      </Card>
    );
  }
  const hint = new Date(v.logged_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <Card title="Vitals" hint={hint}>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">BP</dt>
          <dd className="tabular-nums">
            {v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">HR</dt>
          <dd className="tabular-nums">{v.hr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Glucose</dt>
          <dd className="tabular-nums">
            {v.glucose_mgdl !== null ? `${v.glucose_mgdl.toFixed(0)}` : "—"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
