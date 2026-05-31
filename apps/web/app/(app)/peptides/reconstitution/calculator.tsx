"use client";

import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { reconstitute } from "@peptide/peptides";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, Overline } from "@/components/kit";

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
    <div className="space-y-4">
      <Card title="Inputs">
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
              className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-line)]"
            >
              <option value={100}>U-100 (100 units / mL)</option>
              <option value={30}>U-30 / U-50 (30 or 50 units / mL)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card
        title="Result"
        style={{ borderColor: "var(--primary-line)", background: "var(--primary-wash)" }}
      >
        {!result ? (
          <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--danger)]">
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
              value={result.insulinUnits !== null ? result.insulinUnits.toFixed(1) : "—"}
              unit="units"
              emphasis
            />
          </dl>
        )}
      </Card>

      <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-[var(--fg-subtle)]" />
          <Overline style={{ fontSize: 9.5, letterSpacing: "0.08em" }}>
            Sterile-technique reminders
          </Overline>
        </div>
        <ul className="mt-2 space-y-1 font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.5] text-[var(--fg-muted)]">
          <li>Wipe the vial stopper with an alcohol prep before each draw.</li>
          <li>Inject bacteriostatic water down the side of the vial, slowly.</li>
          <li>Swirl gently; do not shake.</li>
          <li>Use a new needle for every injection. Do not reuse.</li>
          <li>Refrigerate reconstituted peptides per manufacturer / clinician guidance.</li>
          <li>If anything looks cloudy, particulate, or off-color — do not use.</li>
        </ul>
      </div>
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
      <Overline style={{ fontSize: 9.5, letterSpacing: "0.08em" }}>{label}</Overline>
      <dd
        className="mt-1 font-[family-name:var(--font-mono)] tabular-nums"
        style={{
          fontSize: emphasis ? 28 : 20,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: emphasis ? "var(--primary-bright)" : "var(--fg)",
        }}
      >
        {value}
        <span className="ml-1 text-[11px] font-normal text-[var(--fg-subtle)]">{unit}</span>
      </dd>
    </div>
  );
}
