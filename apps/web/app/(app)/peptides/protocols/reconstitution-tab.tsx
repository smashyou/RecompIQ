"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reconstitutePlan, syringeModel, doseFromUnits, SYRINGE_BARRELS } from "@peptide/peptides";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { SyringeVisual } from "./syringe-visual";

interface CompoundOption {
  id: string;
  name: string;
}

type Prefill = { vialMg?: number; doseMg?: number; doseUnit?: string } | null;

export function ReconstitutionTab({
  compounds,
  prefill,
}: {
  compounds: CompoundOption[];
  prefill?: Prefill;
}) {
  const router = useRouter();
  const toast = useFireToast();

  const [vialMg, setVialMg] = useState(prefill?.vialMg ?? 10);
  const [bacWaterMl, setBacWaterMl] = useState(2);
  // Dose entered in mcg or mg; we convert to mg for the math.
  const [doseValue, setDoseValue] = useState(prefill?.doseMg ? prefill.doseMg : 0.5);
  const [doseUnit, setDoseUnit] = useState<"mg" | "mcg">((prefill?.doseUnit as "mcg") ?? "mg");
  const [unitsPerMl, setUnitsPerMl] = useState(100);
  const [barrel, setBarrel] = useState(100);
  const [dosesPerWeek, setDosesPerWeek] = useState<number | "">("");
  const [vialCost, setVialCost] = useState<number | "">("");
  const [compoundId, setCompoundId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const doseMg = doseUnit === "mcg" ? doseValue / 1000 : doseValue;

  const plan = useMemo(() => {
    try {
      return reconstitutePlan({
        vialMg,
        bacWaterMl,
        desiredDoseMg: doseMg,
        syringeUnitsPerMl: unitsPerMl,
        dosesPerWeek: dosesPerWeek === "" ? undefined : dosesPerWeek,
        vialCostUsd: vialCost === "" ? undefined : vialCost,
      });
    } catch {
      return null;
    }
  }, [vialMg, bacWaterMl, doseMg, unitsPerMl, dosesPerWeek, vialCost]);

  const syringe = useMemo(() => {
    if (!plan || plan.insulinUnits === null) return null;
    return syringeModel({ syringeUnitsPerMl: unitsPerMl, barrelCapacityUnits: barrel, fillUnits: plan.insulinUnits });
  }, [plan, unitsPerMl, barrel]);

  async function saveMix() {
    if (!plan) return;
    setSaving(true);
    const res = await fetch("/api/reconstitution/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compound_id: compoundId || null,
        vial_mg: vialMg,
        bac_water_ml: bacWaterMl,
        concentration_mg_per_ml: plan.concentrationMgPerMl,
        desired_dose_mg: doseMg,
        syringe_units_per_ml: unitsPerMl,
        draw_ml: plan.drawMl,
        insulin_units: plan.insulinUnits,
        vial_cost_usd: vialCost === "" ? null : vialCost,
      }),
    });
    setSaving(false);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides/protocols");
      return;
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(b.error?.message ?? "Could not save mix");
      return;
    }
    toast.success("Mix saved to history");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Inputs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Vial (mg)" value={vialMg} step={0.1} onChange={setVialMg} />
          <NumField label="Bacteriostatic water (mL)" value={bacWaterMl} step={0.1} onChange={setBacWaterMl} />

          <div className="space-y-2">
            <Label>Desired dose</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step={doseUnit === "mcg" ? 25 : 0.05}
                min={0}
                value={doseValue}
                onChange={(e) => setDoseValue(e.target.valueAsNumber || 0)}
              />
              <select
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value as "mg" | "mcg")}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cal">Syringe calibration</Label>
            <select
              id="cal"
              value={unitsPerMl}
              onChange={(e) => setUnitsPerMl(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
            >
              <option value={100}>U-100 (100 units / mL)</option>
              <option value={50}>U-50 (50 units / mL)</option>
              <option value={40}>U-40 (40 units / mL)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="barrel">Barrel size</Label>
            <select
              id="barrel"
              value={barrel}
              onChange={(e) => setBarrel(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
            >
              {SYRINGE_BARRELS.map((b) => (
                <option key={b.capacityUnits} value={b.capacityUnits}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="freq">Doses per week (optional)</Label>
            <Input
              id="freq"
              type="number"
              step={0.5}
              min={0}
              placeholder="e.g. 7 daily, 3.5 EOD"
              value={dosesPerWeek}
              onChange={(e) => setDosesPerWeek(e.target.value === "" ? "" : e.target.valueAsNumber || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Vial cost USD (optional)</Label>
            <Input
              id="cost"
              type="number"
              step={1}
              min={0}
              placeholder="for cost-per-dose"
              value={vialCost}
              onChange={(e) => setVialCost(e.target.value === "" ? "" : e.target.valueAsNumber || 0)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-primary)]">
          Result
        </h2>
        {!plan ? (
          <p className="text-sm text-[var(--color-destructive)]">All inputs must be greater than 0.</p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="Concentration" value={plan.concentrationMgPerMl.toFixed(3)} unit="mg/mL" />
              <Stat label="Volume to draw" value={plan.drawMl.toFixed(3)} unit="mL" />
              <Stat
                label={`Insulin units (U-${unitsPerMl})`}
                value={plan.insulinUnits !== null ? plan.insulinUnits.toFixed(1) : "—"}
                unit="units"
                emphasis
              />
              <Stat label="Doses per vial" value={plan.dosesPerVial.toFixed(1)} unit="doses" />
              <Stat
                label="Days of supply"
                value={plan.daysOfSupply !== null ? plan.daysOfSupply.toFixed(0) : "—"}
                unit="days"
              />
              <Stat
                label="Cost per dose"
                value={plan.costPerDoseUsd !== null ? `$${plan.costPerDoseUsd.toFixed(2)}` : "—"}
                unit=""
              />
            </dl>

            {syringe && (
              <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
                <SyringeVisual model={syringe} unitsLabel="units" />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="savecmp">Tag to compound (optional)</Label>
                <select
                  id="savecmp"
                  value={compoundId}
                  onChange={(e) => setCompoundId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
                >
                  <option value="">— none —</option>
                  {compounds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={saveMix} disabled={saving}>
                {saving ? "Saving…" : "Save this mix"}
              </Button>
            </div>
          </>
        )}
      </section>

      <ReverseMode unitsPerMl={unitsPerMl} vialMg={vialMg} bacWaterMl={bacWaterMl} />

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <p className="font-medium text-[var(--color-foreground)]">Sterile-technique reminders</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Wipe the vial stopper with an alcohol prep before each draw.</li>
          <li>Inject bacteriostatic water down the side of the vial, slowly.</li>
          <li>Swirl gently; do not shake.</li>
          <li>Use a new needle for every injection. Do not reuse.</li>
          <li>Refrigerate reconstituted peptides per manufacturer / clinician guidance.</li>
          <li>If anything looks cloudy, particulate, or off-color — do not use.</li>
        </ul>
      </section>
    </div>
  );
}

function ReverseMode({
  unitsPerMl,
  vialMg,
  bacWaterMl,
}: {
  unitsPerMl: number;
  vialMg: number;
  bacWaterMl: number;
}) {
  const [units, setUnits] = useState(10);
  const result = useMemo(() => {
    try {
      return doseFromUnits({ vialMg, bacWaterMl, insulinUnits: units, syringeUnitsPerMl: unitsPerMl });
    } catch {
      return null;
    }
  }, [vialMg, bacWaterMl, units, unitsPerMl]);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Reverse: units → dose
      </h2>
      <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
        Uses the same vial + water above. Enter what you drew on the syringe to confirm the dose.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="rev">Units drawn (U-{unitsPerMl})</Label>
          <Input
            id="rev"
            type="number"
            step={0.5}
            min={0}
            value={units}
            onChange={(e) => setUnits(e.target.valueAsNumber || 0)}
            className="w-40"
          />
        </div>
        {result && (
          <div className="flex gap-6">
            <Stat label="That's" value={result.doseMg.toFixed(3)} unit="mg" />
            <Stat label="=" value={result.doseMcg.toFixed(0)} unit="mcg" emphasis />
          </div>
        )}
      </div>
    </section>
  );
}

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step={step} min={0} value={value} onChange={(e) => onChange(e.target.valueAsNumber || 0)} />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: string;
  unit: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
      <dd
        className={`mt-1 tabular-nums ${
          emphasis ? "text-3xl font-semibold text-[var(--color-primary)]" : "text-xl font-medium"
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">{unit}</span>}
      </dd>
    </div>
  );
}
