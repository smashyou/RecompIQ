"use client";

import { ONBOARDING_STEPS, type OnboardingStep } from "@peptide/shared";

const labels: Record<OnboardingStep, string> = {
  welcome: "Start",
  profile: "About you",
  goal: "Your goal",
  conditions: "Conditions",
  medications: "Medications",
  injuries: "Injuries",
  vision: "AI settings",
  done: "Done",
};

export function ProgressBar({ current }: { current: OnboardingStep }) {
  const idx = ONBOARDING_STEPS.indexOf(current);
  const percent = ((idx + 1) / ONBOARDING_STEPS.length) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>
          Step {idx + 1} of {ONBOARDING_STEPS.length} · {labels[current]}
        </span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
