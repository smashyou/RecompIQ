"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { Card, Overline } from "@/components/kit";

function prettify(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GoalPicker({
  initialSelected,
  compoundNames,
}: {
  initialSelected: string[];
  compoundNames: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useFireToast();
  // Preserve order: selection order = priority.
  const [selected, setSelected] = useState<string[]>(initialSelected);
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
    if (res.status === 401) return router.replace("/signin?next=/goals");
    if (!res.ok) return toast.error("Could not save goals");
    toast.success(selected.length ? `${selected.length} goal${selected.length === 1 ? "" : "s"} saved` : "Goals cleared");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {GOAL_TAXONOMY.map((g) => {
          const on = selected.includes(g.key);
          const rank = selected.indexOf(g.key) + 1;
          return (
            <button key={g.key} type="button" onClick={() => toggle(g.key)} className="text-left">
              <Card
                style={{
                  borderColor: on ? "var(--primary-line)" : "var(--border)",
                  background: on ? "var(--primary-wash)" : "var(--surface-1)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                        {g.label}
                      </h3>
                      {g.hasV1Projection && (
                        <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-px font-[family-name:var(--font-sans)] text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                          projected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                      {g.blurb}
                    </p>
                  </div>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      on
                        ? "border-[var(--primary-line)] bg-[var(--primary)] text-white"
                        : "border-[var(--border)] text-transparent"
                    }`}
                  >
                    {on ? <Check size={12} /> : null}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {g.representativeSlugs.slice(0, 4).map((slug) => (
                    <span
                      key={slug}
                      className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]"
                    >
                      {compoundNames[slug] ?? prettify(slug)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]">
                  Tracks: {g.signals.join(" · ")}
                  {on && rank > 0 ? `  ·  priority ${rank}` : ""}
                </p>
              </Card>
            </button>
          );
        })}
      </div>

      <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
        Compounds shown are an evidence-graded capability mapping, not recommendations. RecompIQ
        educates and tracks — it does not prescribe.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save goals"}
        </Button>
        <Overline>{selected.length} selected</Overline>
      </div>
    </div>
  );
}
