"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";

interface StackItemLite {
  id: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  compound_id: string;
  compounds: { slug: string; name: string };
}

export function DoseLogger({ items }: { items: StackItemLite[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [injectionSite, setInjectionSite] = useState("");
  const [adherence, setAdherence] = useState<"taken" | "skipped" | "partial">("taken");
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        No active stack. Create one in <a href="/peptides/stacks/new" className="underline">New stack</a> before logging doses.
      </p>
    );
  }

  const selected = items.find((i) => i.id === selectedId);

  async function logDose() {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch("/api/doses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stack_item_id: selected.id,
        compound_id: selected.compound_id,
        dose_value: Number(selected.dose_value),
        dose_unit: selected.dose_unit,
        route: selected.route,
        injection_site: injectionSite || null,
        adherence,
        side_effects: [],
      }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides/dose-log");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not log dose");
      return;
    }
    toast.success(`${selected.compounds.name} logged`);
    setSelectedId(null);
    setInjectionSite("");
    setAdherence("taken");
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Log a dose
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const active = selectedId === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelectedId(active ? null : it.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
              }`}
            >
              <p className="text-sm font-medium">{it.compounds.name}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {Number(it.dose_value)} {it.dose_unit} · {it.route} · {it.frequency}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Injection site</Label>
              <Input
                value={injectionSite}
                placeholder="e.g. abdomen L"
                onChange={(e) => setInjectionSite(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Adherence</Label>
              <select
                value={adherence}
                onChange={(e) => setAdherence(e.target.value as "taken" | "skipped" | "partial")}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm"
              >
                <option value="taken">Taken</option>
                <option value="partial">Partial</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>
          <Button onClick={logDose} disabled={submitting} className="w-full">
            {submitting ? "Logging…" : `Log ${Number(selected.dose_value)} ${selected.dose_unit} ${selected.compounds.name}`}
          </Button>
        </div>
      )}
    </section>
  );
}
