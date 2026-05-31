import { Suspense } from "react";
import { BrandSplash } from "@/components/brand-splash";
import { OnboardingFlow } from "./flow";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<BrandSplash />}>
      <OnboardingFlow />
    </Suspense>
  );
}
