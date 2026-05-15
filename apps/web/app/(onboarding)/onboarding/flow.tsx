"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS, type OnboardingStep } from "@peptide/shared";
import { ProgressBar } from "./progress-bar";
import { WelcomeStep } from "./steps/welcome";
import { ProfileStepForm } from "./steps/profile";
import { GoalStepForm } from "./steps/goal";
import { ListStepForm } from "./steps/list-step";
import { VisionStepForm } from "./steps/vision";
import { DoneStep } from "./steps/done";

export interface OnboardingState {
  onboarding_done: boolean;
  profile: Record<string, unknown> | null;
  goal: Record<string, unknown> | null;
  conditions: Record<string, unknown>[];
  medications: Record<string, unknown>[];
  injuries: Record<string, unknown>[];
  settings: Record<string, unknown> | null;
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/onboarding/state");
        const body = (await res.json()) as { data: OnboardingState | null; error: unknown };
        if (cancelled) return;
        if (!res.ok || !body.data) {
          setLoadError("Could not load onboarding state.");
          return;
        }
        setState(body.data);
        if (body.data.onboarding_done) {
          router.replace("/dashboard");
          return;
        }
        // Resume at the first incomplete step.
        if (!body.data.profile?.display_name) setStep("profile");
        else if (!body.data.goal) setStep("goal");
        else setStep("welcome");
      } catch {
        if (!cancelled) setLoadError("Network error loading onboarding state.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function next() {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx >= 0 && idx < ONBOARDING_STEPS.length - 1) {
      setStep(ONBOARDING_STEPS[idx + 1]!);
    }
  }
  function back() {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx > 0) setStep(ONBOARDING_STEPS[idx - 1]!);
  }

  if (loadError) {
    return <p className="text-center text-sm text-[var(--color-destructive)]">{loadError}</p>;
  }
  if (!state) {
    return <p className="text-center text-sm text-[var(--color-muted-foreground)]">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <ProgressBar current={step} />
      {step === "welcome" && <WelcomeStep onNext={next} />}
      {step === "profile" && (
        <ProfileStepForm initial={state.profile} onSaved={next} onBack={back} />
      )}
      {step === "goal" && (
        <GoalStepForm
          initial={state.goal}
          startWeightLb={
            typeof state.profile?.["height_in"] === "number" ? undefined : undefined
          }
          onSaved={next}
          onBack={back}
        />
      )}
      {step === "conditions" && (
        <ListStepForm
          title="Health conditions"
          subtitle="Diagnoses, chronic conditions, allergies. Add as many as apply."
          endpoint="/api/onboarding/conditions"
          fields={["name", "detail"]}
          initial={state.conditions}
          onSaved={next}
          onBack={back}
        />
      )}
      {step === "medications" && (
        <ListStepForm
          title="Current medications"
          subtitle="Prescription + over-the-counter. Include dose when known."
          endpoint="/api/onboarding/medications"
          fields={["name", "dose"]}
          initial={state.medications}
          onSaved={next}
          onBack={back}
        />
      )}
      {step === "injuries" && (
        <ListStepForm
          title="Injuries and limits"
          subtitle="Active or historical injuries that affect what you can train."
          endpoint="/api/onboarding/injuries"
          fields={["name", "detail"]}
          initial={state.injuries}
          onSaved={next}
          onBack={back}
        />
      )}
      {step === "vision" && (
        <VisionStepForm initial={state.settings} onSaved={next} onBack={back} />
      )}
      {step === "done" && <DoneStep />}
    </div>
  );
}
