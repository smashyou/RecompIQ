import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Wallet } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/queries/dashboard";
import { loadSpendSnapshot } from "@/lib/queries/inventory";
import {
  ActiveProtocolCard,
  AdherenceCard,
  CoachInsightCard,
  MacrosCard,
  ProjectionCard,
  VitalsCard,
  WeightCard,
} from "@/components/dashboard/cards";
import { DashboardAddPeptide } from "@/components/dashboard/add-peptide";
import { GoalCards } from "@/components/dashboard/goal-cards";
import { loadGoalCards } from "@/lib/queries/goal-cards";
import { deriveInsight } from "@/components/dashboard/derive";
import { loadAlerts } from "@/lib/queries/alerts";
import { AutoGrid } from "@/components/ui/layout";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const snapshot = await loadDashboard(user.id);

  const supabase = await createSupabaseServerClient();
  const [conditionsRes, medicationsRes, spend, goalCards] = await Promise.all([
    supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
    loadSpendSnapshot(user.id),
    loadGoalCards(user.id),
  ]);
  const conditions = (conditionsRes.data ?? []).map((c) => c.name as string);
  const medications = (medicationsRes.data ?? []).map((m) => m.name as string);
  const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const fullName = snapshot.profile?.display_name ?? user.email ?? "there";
  const firstName = fullName.split(/[\s@]/)[0] || fullName;

  const { active: activeAlerts } = await loadAlerts(user.id, user.email ?? undefined);
  // Banner surfaces only the actionable critical/warn alerts (top few by severity).
  const bannerAlerts = activeAlerts
    .filter((a) => a.severity === "critical" || a.severity === "warn")
    .slice(0, 3);
  const insight = deriveInsight(snapshot);

  return (
    <div className="flex w-full flex-col gap-[var(--space-grid)]">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          {snapshot.profile?.is_demo
            ? "Viewing the demo profile — values are illustrative."
            : "Educational tracking. Not medical advice."}
        </p>
      </header>

      {bannerAlerts.length > 0 && (
        <Link
          href="/alerts"
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
            <span className="font-[family-name:var(--font-sans)] text-sm font-semibold" style={{ color: "var(--warn)" }}>
              {bannerAlerts.length} alert{bannerAlerts.length === 1 ? "" : "s"} need review
            </span>
            <span className="ml-2 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
              {bannerAlerts.map((a) => a.title).join(" · ")}
            </span>
          </div>
          <ChevronRight size={16} style={{ color: "var(--fg-subtle)" }} />
        </Link>
      )}

      <AutoGrid min="260px">
        <WeightCard snapshot={snapshot} />
        <ProjectionCard snapshot={snapshot} />
        <VitalsCard snapshot={snapshot} />
        <MacrosCard snapshot={snapshot} />
        <AdherenceCard snapshot={snapshot} />
        <CoachInsightCard insight={insight} />
      </AutoGrid>

      <GoalCards cards={goalCards} />

      {spend.allTimeUsd > 0 && (
        <Link
          href="/peptides/inventory"
          className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 transition-colors hover:border-[var(--primary-line)]"
        >
          <Wallet size={18} className="text-[var(--primary)]" />
          <div className="flex-1">
            <span className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
              {usd(spend.last30Usd)} spent in the last 30 days
            </span>
            <span className="ml-2 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
              {usd(spend.allTimeUsd)} all-time{spend.topCompound ? ` · most on ${spend.topCompound}` : ""}
            </span>
          </div>
          <ChevronRight size={16} className="text-[var(--fg-subtle)]" />
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.01em] text-[var(--fg)]">
          Active regimen
        </h2>
        <DashboardAddPeptide conditions={conditions} medications={medications} />
      </div>
      <ActiveProtocolCard snapshot={snapshot} />
    </div>
  );
}
