"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";

interface CompoundLite {
  id: string;
  slug: string;
  name: string;
  evidence_level: string;
  fda_approved: boolean;
  typical_route: string | null;
}

interface DraftItem {
  compound_id: string;
  compound_name: string;
  evidence_level: string;
  fda_approved: boolean;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  notes: string;
}

const DOSE_UNITS = ["mg", "mcg", "iu", "ml", "units"] as const;
const ROUTES = ["sc", "im", "iv", "oral", "nasal", "topical", "other"] as const;
const PHASES = ["P1", "P2", "P3", "plateau", "maintenance"] as const;

export function NewStackForm({ compounds }: { compounds: CompoundLite[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<string>("P1");
  const [startedOn, setStartedOn] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function addItem(c: CompoundLite) {
    setItems((prev) => [
      ...prev,
      {
        compound_id: c.id,
        compound_name: c.name,
        evidence_level: c.evidence_level,
        fda_approved: c.fda_approved,
        dose_value: 0,
        dose_unit: "mg",
        route: c.typical_route ?? "sc",
        frequency: "weekly",
        notes: "",
      },
    ]);
  }
  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Give the stack a name.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one compound.");
      return;
    }
    if (items.some((i) => i.dose_value <= 0)) {
      toast.error("All doses must be greater than zero.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/stacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phase,
        started_on: startedOn,
        is_active: true,
        items: items.map((i) => ({
          compound_id: i.compound_id,
          dose_value: i.dose_value,
          dose_unit: i.dose_unit,
          route: i.route,
          frequency: i.frequency,
          notes: i.notes || null,
        })),
      }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides/stacks/new");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not save stack");
      return;
    }
    toast.success("Stack saved");
    router.replace("/peptides");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="space-y-2">
          <Label htmlFor="name">Stack name</Label>
          <Input
            id="name"
            value={name}
            placeholder="e.g. Phase 1 — fat loss + tissue repair"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phase">Phase</Label>
            <select
              id="phase"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="started_on">Started</Label>
            <Input
              id="started_on"
              type="date"
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Compounds in this stack
          </h2>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {items.length} added
          </span>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
            Pick from the catalog below to add compounds.
          </p>
        )}

        {items.map((it, idx) => (
          <div
            key={`${it.compound_id}-${idx}`}
            className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{it.compound_name}</p>
                <EvidenceBadge
                  level={it.evidence_level as never}
                  fdaApproved={it.fda_approved}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1">
                <Label className="text-[10px] uppercase">Dose</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={it.dose_value}
                  onChange={(e) =>
                    updateItem(idx, { dose_value: e.target.valueAsNumber || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Unit</Label>
                <select
                  value={it.dose_unit}
                  onChange={(e) => updateItem(idx, { dose_unit: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm"
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Route</Label>
                <select
                  value={it.route}
                  onChange={(e) => updateItem(idx, { route: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm"
                >
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Frequency</Label>
              <Input
                value={it.frequency}
                placeholder='e.g. "weekly", "EOD", "Mon/Wed/Fri"'
                onChange={(e) => updateItem(idx, { frequency: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Notes</Label>
              <Input
                value={it.notes}
                placeholder="optional"
                onChange={(e) => updateItem(idx, { notes: e.target.value })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Pick compound to add
        </h2>
        <div className="flex flex-wrap gap-2">
          {compounds.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => addItem(c)}
              className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-muted)]"
            >
              <Plus className="h-3 w-3" />
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <a href="/peptides">Cancel</a>
        </Button>
        <Button onClick={save} disabled={submitting} className="flex-1">
          {submitting ? "Saving…" : "Save stack"}
        </Button>
      </div>
    </div>
  );
}
