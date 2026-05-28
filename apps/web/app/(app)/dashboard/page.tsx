import Link from "next/link";
import { Camera } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/queries/dashboard";
import { Card, ComingSoon } from "./cards/card";
import { WeightCard } from "./cards/weight-card";
import { ProjectionCard } from "./cards/projection-card";
import { VitalsCard } from "./cards/vitals-card";
import { SymptomsCard } from "./cards/symptoms-card";
import { ActivityCard } from "./cards/activity-card";
import { MacrosCard } from "./cards/macros-card";
import { AdherenceCard } from "./cards/adherence-card";
import { WorkoutCard } from "./cards/workout-card";

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

      {snapshot.bodyShotReminder && (
        <Link
          href="/body-shots/capture"
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-muted)]"
        >
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-[var(--color-primary)]" />
            <div>
              <p className="text-sm font-medium">Time for new body shots</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {snapshot.bodyShotReminder.lastCapturedAt
                  ? `Last set was ${Math.floor(
                      (Date.now() -
                        new Date(snapshot.bodyShotReminder.lastCapturedAt).getTime()) /
                        86_400_000,
                    )} days ago. You're set to capture every ${snapshot.bodyShotReminder.frequencyDays} days.`
                  : `You haven't taken your first set yet. 4 angles, even lighting.`}
              </p>
            </div>
          </div>
          <span className="text-xs text-[var(--color-primary)]">Capture →</span>
        </Link>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WeightCard snapshot={snapshot} />
        <ProjectionCard snapshot={snapshot} />
        <VitalsCard snapshot={snapshot} />
        <SymptomsCard snapshot={snapshot} />
        <ActivityCard snapshot={snapshot} />
        <MacrosCard snapshot={snapshot} macros={snapshot.macrosToday} />
        <AdherenceCard
          recentDoses={snapshot.recentDoses}
          hasActiveStack={snapshot.hasActiveStack}
        />
        <WorkoutCard
          todayWorkout={snapshot.todayWorkout}
          suggestion={snapshot.workoutSuggestion}
        />
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
