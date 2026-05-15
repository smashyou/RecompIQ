import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/queries/dashboard";
import { Card, ComingSoon } from "./cards/card";
import { WeightCard } from "./cards/weight-card";
import { ProjectionCard } from "./cards/projection-card";
import { VitalsCard } from "./cards/vitals-card";
import { SymptomsCard } from "./cards/symptoms-card";
import { ActivityCard } from "./cards/activity-card";
import { MacrosCard } from "./cards/macros-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const snapshot = await loadDashboard(user.id);
  const name = snapshot.profile?.display_name ?? user.email ?? "there";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {name}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {snapshot.profile?.is_demo
            ? "Viewing the demo profile — values are illustrative."
            : "Educational tracking. Not medical advice."}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WeightCard snapshot={snapshot} />
        <ProjectionCard snapshot={snapshot} />
        <VitalsCard snapshot={snapshot} />
        <SymptomsCard snapshot={snapshot} />
        <ActivityCard snapshot={snapshot} />
        <MacrosCard snapshot={snapshot} macros={snapshot.macrosToday} />

        <Card title="Peptide adherence" hint="Phase 6">
          <ComingSoon phase={6} />
        </Card>
        <Card title="Today's workout" hint="Phase 7">
          <ComingSoon phase={7} />
        </Card>
        <Card title="Safety alerts" hint="Phase 8">
          <ComingSoon phase={8} />
        </Card>
        <Card title="AI insight" hint="Phase 9">
          <ComingSoon phase={9} />
        </Card>
      </section>
    </div>
  );
}
