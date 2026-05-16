import { ReconstitutionCalculator } from "./calculator";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

export const dynamic = "force-dynamic";

export default function ReconstitutionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reconstitution calculator</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Calculates concentration, draw volume, and insulin-syringe units from vial size +
          bacteriostatic water + desired dose.
        </p>
      </header>
      <ReconstitutionCalculator />
      <SafetyDisclaimer />
    </div>
  );
}
