"use client";

import { useState } from "react";
import { ConsentGate } from "@/components/consent-gate";

// First onboarding step: the required consent + 18+ age gate. Records
// profiles.educational_consent_at, then advances. There is no "back" target
// before this step.
export function ConsentStep({ onAccepted }: { onAccepted: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/consent", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "Could not record consent. Please try again.");
        setSubmitting(false);
        return;
      }
      onAccepted();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return <ConsentGate onEnter={accept} submitting={submitting} error={error} />;
}
