import { Suspense } from "react";
import { OnboardingFlow } from "./flow";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm">Loading…</div>}>
      <OnboardingFlow />
    </Suspense>
  );
}
