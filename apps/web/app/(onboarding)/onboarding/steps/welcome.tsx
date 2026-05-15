"use client";

import { Button } from "@/components/ui/button";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to RecompIQ</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          A few short steps to personalize your tracking. You can edit any of this later in Settings.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
        <li>• About you — basic anthropometrics</li>
        <li>• Your goal — target weight + timeline</li>
        <li>• Health context — conditions, medications, injuries</li>
        <li>• AI settings — which vision model parses your food photos</li>
      </ul>
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <strong className="text-[var(--color-foreground)]">Important.</strong> RecompIQ
        educates and tracks. It does not prescribe doses, diagnose conditions, or replace
        medical care. Discuss any protocol changes with a licensed clinician.
      </p>
      <Button onClick={onNext} className="w-full">
        Let&apos;s go
      </Button>
    </div>
  );
}
