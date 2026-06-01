import { requireUser } from "@/lib/auth";
import { loadLabs } from "@/lib/queries/labs";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { LabsClient } from "./labs-client";

export const dynamic = "force-dynamic";

export default async function LabsPage() {
  const user = await requireUser();
  const { rows } = await loadLabs(user.id);

  return (
    <div className="mx-auto max-w-[920px]">
      <SectionHeader title="Labs & biomarkers" note="self-tracked · educational, not diagnostic" />
      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Upload a lab report photo or PDF and RecompIQ reads your markers, or enter values by hand.
        Out-of-range values are flagged for you to discuss with a clinician — RecompIQ does not
        interpret results or give medical advice.
      </p>

      <LabsClient initialRows={rows} />

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
