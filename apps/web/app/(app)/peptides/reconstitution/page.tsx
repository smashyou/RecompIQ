import { ReconstitutionCalculator } from "./calculator";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";

export const dynamic = "force-dynamic";

export default function ReconstitutionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title="Reconstitution calculator" note="math on your inputs" />
      <p className="mb-6 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Calculates concentration, draw volume, and insulin-syringe units from vial size +
        bacteriostatic water + desired dose. It does math on the numbers you enter — it does not
        recommend doses.
      </p>
      <ReconstitutionCalculator />
      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
