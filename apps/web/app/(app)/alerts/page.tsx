import { requireUser } from "@/lib/auth";
import { loadAlerts } from "@/lib/queries/alerts";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { AlertsClient } from "./alerts-client";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await requireUser();
  const { active, history } = await loadAlerts(user.id);
  return (
    <div>
      <SectionHeader
        title="Safety alerts"
        note="observations to discuss with your clinician · not medical advice"
      />
      <p className="mb-5 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        RecompIQ flags patterns in the data you logged — high blood pressure or glucose, rapid weight
        loss, possible contraindications, and more — for you to discuss with a clinician. It does not
        diagnose, prescribe, or tell you to change a dose.
      </p>
      <AlertsClient initialActive={active} initialHistory={history} />
      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
