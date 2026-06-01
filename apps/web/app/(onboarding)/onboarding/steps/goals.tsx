"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { Button } from "@/components/ui/button";

export function GoalsStepForm({ onSaved, onBack }: { onSaved: () => void; onBack: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goals: selected.map((goal_key, i) => ({ goal_key, priority: i + 1, status: "active" })),
      }),
    });
    setBusy(false);
    if (res.status === 401) return router.replace("/signin?next=/onboarding");
    // Goals are optional — proceed regardless of a transient save error.
    onSaved();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.01em] text-[var(--fg)]">
          What are your goals?
        </h2>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
          Pick the outcomes you care about — they decide what RecompIQ tracks and projects, and guide
          the AI when it helps you build a regimen. You can change these anytime. (Optional.)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-grid)] sm:grid-cols-2">
        {GOAL_TAXONOMY.map((g) => {
          const on = selected.includes(g.key);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggle(g.key)}
              className="flex items-start justify-between gap-2 rounded-[var(--r-lg)] border px-3.5 py-3 text-left transition-colors"
              style={{
                borderColor: on ? "var(--primary-line)" : "var(--border)",
                background: on ? "var(--primary-wash)" : "var(--surface-1)",
              }}
            >
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
                  {g.label}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                  {g.blurb}
                </p>
              </div>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  on ? "border-[var(--primary-line)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-transparent"
                }`}
              >
                {on ? <Check size={12} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : selected.length ? `Continue (${selected.length})` : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
