"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { syringeModel, SYRINGE_BARRELS } from "@peptide/peptides";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { Card, MetricBox, Overline } from "@/components/kit";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SyringeVisual } from "./syringe-visual";

interface CompoundOption {
  id: string;
  slug: string;
  name: string;
  is_blend: boolean;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[];
  ref_dose: { low: number; high: number; unit: string } | null;
}

export function ReconstitutionTab({
  compounds,
  compoundId,
  onCompoundChange,
}: {
  compounds: CompoundOption[];
  compoundId: string;
  onCompoundChange: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useFireToast();

  const [vialMg, setVialMg] = useState(10);
  const [bacWaterMl, setBacWaterMl] = useState(2);
  const [unitsPerMl, setUnitsPerMl] = useState(100);
  const [barrel, setBarrel] = useState(100);
  const [mode, setMode] = useState<"dose" | "units">("dose");
  const [doseValue, setDoseValue] = useState(0.5);
  const [doseUnit, setDoseUnit] = useState<"mg" | "mcg">("mg");
  const [drawUnits, setDrawUnits] = useState(10);
  const [dosesPerWeek, setDosesPerWeek] = useState<number | "">("");
  const [vialCost, setVialCost] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const selected = compounds.find((c) => c.id === compoundId) ?? null;

  // When the selected peptide changes (picker, deep link, or Compound Reference
  // tab), load its typical vial size + reference dose.
  useEffect(() => {
    if (!selected) return;
    if (selected.typical_vial_mg && selected.typical_vial_mg > 0) setVialMg(selected.typical_vial_mg);
    if (selected.ref_dose && (selected.ref_dose.unit === "mg" || selected.ref_dose.unit === "mcg")) {
      setDoseUnit(selected.ref_dose.unit);
      setDoseValue(selected.ref_dose.low);
      setMode("dose");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundId]);

  const concentration = vialMg > 0 && bacWaterMl > 0 ? vialMg / bacWaterMl : 0; // mg/mL
  const doseMg = doseUnit === "mcg" ? doseValue / 1000 : doseValue;

  // Unified forward (dose→volume) / reverse (units→dose) computation.
  const calc = useMemo(() => {
    if (concentration <= 0) return null;
    let drawMl: number;
    let effDoseMg: number;
    let units: number;
    if (mode === "dose") {
      if (!(doseMg > 0)) return null;
      effDoseMg = doseMg;
      drawMl = effDoseMg / concentration;
      units = drawMl * unitsPerMl;
    } else {
      if (!(drawUnits > 0)) return null;
      units = drawUnits;
      drawMl = drawUnits / unitsPerMl;
      effDoseMg = drawMl * concentration;
    }
    if (!(drawMl > 0)) return null;
    const dosesPerVial = vialMg / effDoseMg;
    const daysOfSupply = dosesPerWeek && dosesPerWeek > 0 ? (dosesPerVial * 7) / dosesPerWeek : null;
    const costPerDose = vialCost && vialCost > 0 ? vialCost / dosesPerVial : null;
    return { drawMl, effDoseMg, units, dosesPerVial, daysOfSupply, costPerDose };
  }, [concentration, mode, doseMg, drawUnits, unitsPerMl, vialMg, dosesPerWeek, vialCost]);

  const syringe = useMemo(() => {
    if (!calc) return null;
    return syringeModel({ syringeUnitsPerMl: unitsPerMl, barrelCapacityUnits: barrel, fillUnits: calc.units });
  }, [calc, unitsPerMl, barrel]);

  const blendDelivery = useMemo(() => {
    if (!selected?.is_blend || !calc || bacWaterMl <= 0) return null;
    return (selected.component_mg ?? [])
      .filter((c) => typeof c.mg === "number" && c.mg !== null)
      .map((c) => ({ label: c.label, mg: c.mg as number, deliveredMg: calc.drawMl * ((c.mg as number) / bacWaterMl) }));
  }, [selected, calc, bacWaterMl]);

  // Per-unit conversion (one syringe tick = this much drug).
  const mgPerUnit = concentration > 0 ? concentration / unitsPerMl : 0;

  // Quick-fill values from the reference range (dose mode only).
  const quickFills =
    selected?.ref_dose && (selected.ref_dose.unit === "mg" || selected.ref_dose.unit === "mcg")
      ? Array.from(new Set([selected.ref_dose.low, (selected.ref_dose.low + selected.ref_dose.high) / 2, selected.ref_dose.high]))
      : null;

  async function saveMix() {
    if (!calc) return;
    setSaving(true);
    const res = await fetch("/api/reconstitution/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compound_id: compoundId || null,
        vial_mg: vialMg,
        bac_water_ml: bacWaterMl,
        concentration_mg_per_ml: concentration,
        desired_dose_mg: calc.effDoseMg,
        syringe_units_per_ml: unitsPerMl,
        draw_ml: calc.drawMl,
        insulin_units: calc.units,
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
      <SafetyDisclaimer variant="compact" />

      {/* STEP 1 — product + reconstitution */}
      <Card pad={20}>
        <Step n={1} title="Product & reconstitution" />

        <div className="mt-4 space-y-2">
          <Label htmlFor="picker">Peptide / blend</Label>
          <select
            id="picker"
            value={compoundId}
            onChange={(e) => onCompoundChange(e.target.value)}
            className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 font-[family-name:var(--font-sans)] text-sm text-[var(--fg)]"
          >
            <option value="">— choose a peptide (loads its vial + reference dose) —</option>
            {compounds.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_blend ? "★ " : ""}
                {c.name}
              </option>
            ))}
          </select>
          {selected?.ref_dose && (
            <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
              Reference:{" "}
              <span className="font-medium text-[var(--fg)]">
                {selected.ref_dose.low}
                {selected.ref_dose.high !== selected.ref_dose.low ? `–${selected.ref_dose.high}` : ""} {selected.ref_dose.unit}
              </span>{" "}
              — educational starting point, override freely.
            </p>
          )}
          {selected?.is_blend && selected.component_mg.length > 0 && (
            <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
              Composition:{" "}
              <span className="text-[var(--fg)]">
                {selected.component_mg.map((c) => `${c.label}${c.mg !== null ? ` ${c.mg} mg` : ""}`).join(" / ")}
              </span>
              {selected.typical_vial_mg ? ` · ${selected.typical_vial_mg} mg total` : ""}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumField label={selected?.is_blend ? "Vial total (mg)" : "Vial (mg)"} value={vialMg} step={0.1} onChange={setVialMg} />
          <NumField label="Bacteriostatic water (mL)" value={bacWaterMl} step={0.1} onChange={setBacWaterMl} />
          <SelectField
            label="Syringe calibration"
            value={unitsPerMl}
            onChange={setUnitsPerMl}
            options={[
              { value: 100, label: "U-100 (100 units / mL)" },
              { value: 50, label: "U-50 (50 units / mL)" },
              { value: 40, label: "U-40 (40 units / mL)" },
            ]}
          />
          <SelectField
            label="Barrel size"
            value={barrel}
            onChange={setBarrel}
            options={SYRINGE_BARRELS.map((b) => ({ value: b.capacityUnits, label: b.label }))}
          />
        </div>

        {/* concentration callout */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <div>
            <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>Concentration</Overline>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xl font-medium tabular-nums tracking-[-0.02em] text-[var(--primary-bright)]">
              {concentration > 0 ? concentration.toFixed(3) : "—"}
              <span className="ml-1 text-2xs font-normal text-[var(--fg-subtle)]">mg/mL</span>
            </p>
          </div>
          <div className="text-right">
            <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>Per syringe unit</Overline>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-[var(--fg)]">
              {mgPerUnit > 0 ? (mgPerUnit >= 1 ? `${mgPerUnit.toFixed(3)} mg` : `${(mgPerUnit * 1000).toFixed(1)} mcg`) : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* STEP 2 — dose, with either/or toggle */}
      <Card pad={20}>
        <Step n={2} title="Dose" />

        <div className="mt-4 inline-flex rounded-[var(--r-md)] border border-[var(--border)] p-1">
          <ToggleBtn active={mode === "dose"} onClick={() => setMode("dose")}>
            By dose
          </ToggleBtn>
          <ToggleBtn active={mode === "units"} onClick={() => setMode("units")}>
            By units drawn
          </ToggleBtn>
        </div>

        {mode === "dose" ? (
          <div className="mt-4 space-y-3">
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
                  className="h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 font-[family-name:var(--font-sans)] text-sm text-[var(--fg)]"
                >
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                </select>
              </div>
            </div>
            {quickFills && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                  Quick fill:
                </span>
                {quickFills.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setDoseUnit(selected!.ref_dose!.unit as "mg" | "mcg");
                      setDoseValue(Number(v.toFixed(selected!.ref_dose!.unit === "mcg" ? 0 : 3)));
                    }}
                    className="rounded-[var(--r-sm)] border border-[var(--border)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                  >
                    {Number(v.toFixed(selected!.ref_dose!.unit === "mcg" ? 0 : 3))} {selected!.ref_dose!.unit}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Label>Units to draw (U-{unitsPerMl})</Label>
            <Input
              type="number"
              step={0.5}
              min={0}
              value={drawUnits}
              onChange={(e) => setDrawUnits(e.target.valueAsNumber || 0)}
              className="w-40"
            />
            <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
              Enter what you drew on the syringe — we compute the dose it delivers.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumOptField label="Doses per week (optional)" value={dosesPerWeek} onChange={setDosesPerWeek} placeholder="7 daily, 3.5 EOD" />
          <NumOptField label="Vial cost USD (optional)" value={vialCost} onChange={setVialCost} placeholder="for cost-per-dose" />
        </div>
      </Card>

      {/* RESULT */}
      <Card
        title="Result"
        pad={20}
        style={{ borderColor: "var(--primary-line)", background: "var(--primary-wash)" }}
      >
        {!calc ? (
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--danger)]">
            Enter a vial, water, and dose (all &gt; 0).
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <BigStat label="Injection volume" value={calc.drawMl.toFixed(3)} unit="mL" />
              <BigStat label={`Draw to (U-${unitsPerMl})`} value={calc.units.toFixed(1)} unit="units" emphasis />
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricBox
                label={mode === "units" ? "Delivers" : "Dose"}
                value={calc.effDoseMg >= 1 ? calc.effDoseMg.toFixed(3) : (calc.effDoseMg * 1000).toFixed(0)}
                unit={calc.effDoseMg >= 1 ? "mg" : "mcg"}
              />
              <MetricBox label="Doses per vial" value={calc.dosesPerVial.toFixed(1)} unit="doses" />
              <MetricBox label="Days of supply" value={calc.daysOfSupply !== null ? calc.daysOfSupply.toFixed(0) : "—"} unit="days" />
              <MetricBox label="Cost per dose" value={calc.costPerDose !== null ? `$${calc.costPerDose.toFixed(2)}` : "—"} />
            </dl>

            {syringe && (
              <div className="mt-6 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
                <SyringeVisual model={syringe} unitsLabel="units" />
              </div>
            )}

            {blendDelivery && blendDelivery.length > 0 && (
              <div className="mt-6 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
                <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                  Per-component delivered at {calc.drawMl.toFixed(3)} mL
                </Overline>
                <div className="overflow-x-auto">
                  <table className="w-full font-[family-name:var(--font-sans)] text-sm">
                    <tbody>
                      {blendDelivery.map((c) => (
                        <tr key={c.label} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-1.5 text-[var(--fg)]">{c.label}</td>
                          <td className="py-1.5 text-right text-xs text-[var(--fg-subtle)]">{c.mg} mg in vial</td>
                          <td className="py-1.5 text-right font-[family-name:var(--font-mono)] font-medium tabular-nums text-[var(--fg)]">
                            {c.deliveredMg >= 1 ? `${c.deliveredMg.toFixed(2)} mg` : `${(c.deliveredMg * 1000).toFixed(0)} mcg`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-subtle)]">
                  A blend is drawn as one volume; each component is delivered in its fixed ratio. Educational only.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-[var(--primary-line)] pt-4">
              <Button onClick={saveMix} disabled={saving} variant="outline">
                {saving ? "Saving…" : "Save this mix"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>
          Sterile-technique reminders
        </Overline>
        <ul className="mt-2 space-y-1 font-[family-name:var(--font-sans)] text-xs leading-[1.5] text-[var(--fg-muted)]">
          <li>Wipe the vial stopper with an alcohol prep before each draw.</li>
          <li>Inject bacteriostatic water down the side of the vial, slowly; swirl, don&apos;t shake.</li>
          <li>Use a new needle for every injection. Refrigerate per guidance.</li>
          <li>If anything looks cloudy, particulate, or off-color — do not use.</li>
        </ul>
        <p className="mt-2 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
          This tool does math on the numbers you enter. It does not recommend doses.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[var(--r-sm)] border border-[var(--primary-line)] bg-[var(--primary-wash)] font-[family-name:var(--font-mono)] text-2xs font-semibold text-[var(--primary-bright)]">
        {n}
      </span>
      <h2 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">{title}</h2>
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[var(--r-sm)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium transition-colors",
        active
          ? "bg-[var(--primary-wash)] text-[var(--primary-bright)]"
          : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

function NumField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step={step} min={0} value={value} onChange={(e) => onChange(e.target.valueAsNumber || 0)} />
    </div>
  );
}

function NumOptField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step={0.5}
        min={0}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : e.target.valueAsNumber || 0)}
      />
    </div>
  );
}

function SelectField<T extends number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as T)}
        className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 font-[family-name:var(--font-sans)] text-sm text-[var(--fg)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BigStat({ label, value, unit, emphasis }: { label: string; value: string; unit: string; emphasis?: boolean }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>{label}</Overline>
      <p
        className="mt-1 font-[family-name:var(--font-mono)] tabular-nums"
        style={{
          fontSize: emphasis ? "var(--text-3xl)" : "var(--text-2xl)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: emphasis ? "var(--primary-bright)" : "var(--fg)",
        }}
      >
        {value}
        <span className="ml-1 text-xs font-normal text-[var(--fg-subtle)]">{unit}</span>
      </p>
    </div>
  );
}
