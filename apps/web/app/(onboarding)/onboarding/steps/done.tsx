"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DoneStep() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function finish() {
    setServerError(null);
    setSubmitting(true);
    const res = await fetch("/api/onboarding/complete", { method: "POST" });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      setServerError(body.error?.message ?? "Could not complete onboarding");
      setSubmitting(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--color-accent)]" />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">You&apos;re set</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          You can now log weight, vitals, food, and peptide doses. Your coach will personalize as
          data comes in.
        </p>
      </div>
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-left text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <strong className="text-[var(--color-foreground)]">Reminder.</strong> RecompIQ tracks and
        educates. It does not prescribe doses or replace medical care. Discuss any protocol changes
        with a licensed clinician.
      </p>
      {serverError && <p className="text-xs text-[var(--color-destructive)]">{serverError}</p>}
      <Button onClick={finish} disabled={submitting} className="w-full">
        {submitting ? "Finishing…" : "Go to dashboard"}
      </Button>
    </div>
  );
}
