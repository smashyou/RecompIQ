import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/queries/dashboard";
import {
  ActiveProtocolCard,
  AdherenceCard,
  CoachInsightCard,
  MacrosCard,
  ProjectionCard,
  VitalsCard,
  WeightCard,
} from "@/components/dashboard/cards";
import { deriveAlerts, deriveInsight } from "@/components/dashboard/derive";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const snapshot = await loadDashboard(user.id);

  const fullName = snapshot.profile?.display_name ?? user.email ?? "there";
  const firstName = fullName.split(/[\s@]/)[0] || fullName;

  const alerts = deriveAlerts(snapshot);
  const insight = deriveInsight(snapshot);

  return (
    <div className="flex max-w-[1080px] flex-col gap-[18px]">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[13.5px] text-[var(--fg-subtle)]">
          {snapshot.profile?.is_demo
            ? "Viewing the demo profile — values are illustrative."
            : "Educational tracking. Not medical advice."}
        </p>
      </header>

      {alerts.length > 0 && (
        <Link
          href="/log"
          className="flex items-center gap-3 rounded-[var(--r-md)] border px-4 py-3 transition-colors"
          style={{
            borderColor: "var(--warn-line)",
            background: "var(--warn-wash)",
          }}
        >
          <AlertTriangle
            size={18}
            className="flex-none"
            style={{ color: "var(--warn)" }}
          />
          <div className="flex-1">
            <span className="font-[family-name:var(--font-sans)] text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
              {alerts.length} alert{alerts.length === 1 ? "" : "s"} need review
            </span>
            <span className="ml-2 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
              {alerts.map((a) => a.detail).join(" · ")}
            </span>
          </div>
          <ChevronRight size={16} style={{ color: "var(--fg-subtle)" }} />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-3">
        <WeightCard snapshot={snapshot} />
        <ProjectionCard snapshot={snapshot} />
        <VitalsCard snapshot={snapshot} />
        <MacrosCard snapshot={snapshot} />
        <AdherenceCard snapshot={snapshot} />
        <CoachInsightCard insight={insight} />
      </div>

      <ActiveProtocolCard snapshot={snapshot} />
    </div>
  );
}
