"use client";

import { useMemo, useState } from "react";
import { reconstitute } from "@peptide/peptides";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReconstitutionCalculator() {
  const [vialMg, setVialMg] = useState(10);
  const [bacWaterMl, setBacWaterMl] = useState(2);
  const [doseMg, setDoseMg] = useState(2);
  const [syringe, setSyringe] = useState<100 | 30>(100); // U-100 vs U-30 (BD typical)

  const result = useMemo(() => {
    try {
      return reconstitute({
        vialMg,
        bacWaterMl,
        desiredDoseMg: doseMg,
        syringeUnitsPerMl: syringe,
      });
    } catch {
      return null;
    }
  }, [vialMg, bacWaterMl, doseMg, syringe]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Inputs
        </h2>
        <div className="space-y-4">
          <NumField label="Vial (mg)" value={vialMg} step={0.1} onChange={setVialMg} />
          <NumField
            label="Bacteriostatic water added (mL)"
            value={bacWaterMl}
            step={0.1}
            onChange={setBacWaterMl}
          />
          <NumField label="Desired dose (mg)" value={doseMg} step={0.05} onChange={setDoseMg} />
          <div className="space-y-2">
            <Label htmlFor="syringe">Insulin syringe</Label>
            <select
              id="syringe"
              value={syringe}
              onChange={(e) => setSyringe(Number(e.target.value) as 100 | 30)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <option value={100}>U-100 (100 units / mL)</option>
              <option value={30}>U-30 / U-50 (30 or 50 units / mL)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-primary)]">
          Result
        </h2>
        {!result ? (
          <p className="text-sm text-[var(--color-destructive)]">
            All inputs must be greater than 0.
          </p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <ResultStat
              label="Concentration"
              value={result.concentrationMgPerMl.toFixed(3)}
              unit="mg/mL"
            />
            <ResultStat label="Volume to draw" value={result.drawMl.toFixed(3)} unit="mL" />
            <ResultStat
              label={`Insulin units (U-${syringe})`}
              value={
                result.insulinUnits !== null ? result.insulinUnits.toFixed(1) : "—"
              }
              unit="units"
              emphasis
            />
          </dl>
        )}
      </section>

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
      <Input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      />
    </div>
  );
}

function ResultStat({
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
        <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
          {unit}
        </span>
      </dd>
    </div>
  );
}
