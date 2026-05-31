"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { DOSE_UNIT, ROUTE, type DoseUnit, type Route } from "@peptide/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";

interface CompoundOption {
  id: string;
  name: string;
}

interface WeekRow {
  compound_id: string;
  week_number: number;
  dose_value: number;
  dose_unit: DoseUnit;
  route: Route;
  frequency: string;
}

export function ProtocolBuilderTab({
  compounds,
  defaultCompoundId,
}: {
  compounds: CompoundOption[];
  defaultCompoundId?: string;
}) {
  const router = useRouter();
  const toast = useFireToast();
  const [name, setName] = useState("");
  // Default the first week's compound to the peptide carried over from the
  // calculator / detail page, falling back to the first catalog compound.
  const firstCompound = defaultCompoundId || compounds[0]?.id || "";
  const [rows, setRows] = useState<WeekRow[]>([
    {
      compound_id: firstCompound,
      week_number: 1,
      dose_value: 0,
      dose_unit: "mg",
      route: "sc",
      frequency: "weekly",
    },
  ]);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<WeekRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      {
        compound_id: last?.compound_id ?? compounds[0]?.id ?? "",
        week_number: (last?.week_number ?? 0) + 1,
        dose_value: last?.dose_value ?? 0,
        dose_unit: last?.dose_unit ?? "mg",
        route: last?.route ?? "sc",
        frequency: last?.frequency ?? "weekly",
      },
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Give the protocol a name.");
      return;
    }
    const weeks = rows.filter((r) => r.compound_id && r.dose_value > 0);
    if (weeks.length === 0) {
      toast.error("Add at least one week with a compound + dose.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/protocols", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), weeks }),
    });
    setSaving(false);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides/protocols");
      return;
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(b.error?.message ?? "Could not save protocol");
      return;
    }
    toast.success("Protocol saved");
    router.replace("/peptides/protocols?tab=titration");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Build your own (or your clinician&apos;s) week-by-week titration plan. All values are
        yours — the app stores and schedules them, it doesn&apos;t prescribe.
      </p>

      <div className="space-y-2">
        <Label htmlFor="pname">Protocol name</Label>
        <Input
          id="pname"
          placeholder="e.g. Reta ramp — weeks 1–8"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:grid-cols-12 sm:items-end"
          >
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs">Wk</Label>
              <Input
                type="number"
                min={1}
                value={r.week_number}
                onChange={(e) => update(i, { week_number: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1 sm:col-span-4">
              <Label className="text-xs">Compound</Label>
              <select
                value={r.compound_id}
                onChange={(e) => update(i, { compound_id: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm"
              >
                {compounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Dose</Label>
              <Input
                type="number"
                step={0.05}
                min={0}
                value={r.dose_value}
                onChange={(e) => update(i, { dose_value: e.target.valueAsNumber || 0 })}
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs">Unit</Label>
              <select
                value={r.dose_unit}
                onChange={(e) => update(i, { dose_unit: e.target.value as DoseUnit })}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-1 text-sm"
              >
                {DOSE_UNIT.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Frequency</Label>
              <Input
                value={r.frequency}
                onChange={(e) => update(i, { frequency: e.target.value })}
                placeholder="weekly"
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs">Route</Label>
              <select
                value={r.route}
                onChange={(e) => update(i, { route: e.target.value as Route })}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-1 text-sm"
              >
                {ROUTE.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="rounded-md border border-[var(--color-border)] p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-40"
                aria-label="Remove week"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add week
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save protocol"}
        </Button>
      </div>
    </div>
  );
}
