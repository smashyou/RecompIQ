"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Dismiss control for a generated insight. Isolated so the card itself stays a server component. */
export function InsightDismiss({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  async function dismiss() {
    setFailed(false);
    try {
      const res = await fetch(`/api/insights/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      startTransition(() => router.refresh());
    } catch {
      setFailed(true);
    }
  }

  return (
    <button
      type="button"
      onClick={dismiss}
      disabled={pending}
      aria-label={failed ? "Dismiss failed — try again" : "Dismiss insight"}
      title={failed ? "Couldn't dismiss — try again" : "Dismiss"}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-foreground disabled:opacity-50"
      style={failed ? { color: "var(--warn-line)" } : undefined}
    >
      <X size={13} />
    </button>
  );
}
