"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, Search, ShieldAlert } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import {
  doseFromUnits,
  reconstitutePlan,
  syringeModel,
  SYRINGE_BARRELS,
  SYRINGE_CALIBRATIONS,
} from "@peptide/peptides/reconstitution";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, Overline } from "@/components/kit";
import { Cluster } from "@/components/ui/layout";
import { useFireToast } from "@/components/ui/toast";
import { Syringe } from "@/components/peptides/syringe";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";

// Plain serializable shape passed from the server page.
export interface CompoundOption {
  id: string;
  slug: string;
  name: string;
  is_blend: boolean;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[];
  ref_dose: { low: number; high: number; unit: string; evidence_level: EvidenceLevel } | null;
}

const CALIBRATIONS = SYRINGE_CALIBRATIONS.map((c) => ({
  value: String(c.unitsPerMl),
  label: c.label.replace(/ \(.*\)/, ""),
}));
const BARRELS = SYRINGE_BARRELS.map((b) => ({
  value: String(b.capacityUnits),
  label: b.label.replace(/ \(.*\)/, ""),
}));
const MODES = [
  { value: "dose", label: "By dose" },
  { value: "units", label: "By units drawn" },
] as const;
const DOSE_UNITS = [
  { value: "mg", label: "mg" },
  { value: "mcg", label: "mcg" },
] as const;

function num(s: string): number {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
function fmtMg(mg: number): string {
  return mg >= 1 ? `${mg.toFixed(2)} mg` : `${(mg * 1000).toFixed(0)} mcg`;
}

export function ReconstitutionCalculator({
  options,
  initialSlug,
}: {
  options: CompoundOption[];
  initialSlug: string | null;
}) {
  const toast = useFireToast();

  const [slug, setSlug] = useState<string | null>(initialSlug);
  const selected = useMemo(() => options.find((o) => o.slug === slug) ?? null, [options, slug]);
  const compoundId = selected?.id ?? "";

  const [vialMg, setVialMg] = useState("10");
  const [bac, setBac] = useState("2");
  const [unitsPerMl, setUnitsPerMl] = useState("100");
  const [barrel, setBarrel] = useState("100");
  const [mode, setMode] = useState<"dose" | "units">("dose");
  const [doseValue, setDoseValue] = useState("0.5");
  const [doseUnit, setDoseUnit] = useState<"mg" | "mcg">("mg");
  const [drawUnits, setDrawUnits] = useState("10");
  const [dosesPerWeek, setDosesPerWeek] = useState("");
  const [vialCost, setVialCost] = useState("");
  const [saving, setSaving] = useState(false);

  // On compound selection, load typical vial + reference dose (mirrors mobile).
  useEffect(() => {
    if (!selected) return;
    if (selected.typical_vial_mg && selected.typical_vial_mg > 0) {
      setVialMg(String(selected.typical_vial_mg));
    }
    if (selected.ref_dose && (selected.ref_dose.unit === "mg" || selected.ref_dose.unit === "mcg")) {
      setDoseUnit(selected.ref_dose.unit);
      setDoseValue(String(selected.ref_dose.low));
      setMode("dose");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundId]);

  const vMg = num(vialMg);
  const bacMl = num(bac);
  const upm = num(unitsPerMl);
  const concentration = vMg > 0 && bacMl > 0 ? vMg / bacMl : 0;
  const doseMg = doseUnit === "mcg" ? num(doseValue) / 1000 : num(doseValue);

  // ALL computation runs through the shared pure math. Forward ("by dose") uses
  // reconstitutePlan (concentration + draw + units + doses/vial + days-of-supply
  // + cost/dose). Reverse ("by units drawn") uses doseFromUnits, then feeds the
  // derived dose back through reconstitutePlan for the supply/cost layer.
  const calc = useMemo(() => {
    if (concentration <= 0) return null;
    try {
      if (mode === "dose") {
        if (!(doseMg > 0)) return null;
        const plan = reconstitutePlan({
          vialMg: vMg,
          bacWaterMl: bacMl,
          desiredDoseMg: doseMg,
          syringeUnitsPerMl: upm,
          dosesPerWeek: num(dosesPerWeek) > 0 ? num(dosesPerWeek) : undefined,
          vialCostUsd: num(vialCost) > 0 ? num(vialCost) : undefined,
        });
        return {
          drawMl: plan.drawMl,
          effDoseMg: doseMg,
          units: plan.insulinUnits ?? 0,
          dosesPerVial: plan.dosesPerVial,
          daysOfSupply: plan.daysOfSupply,
          costPerDose: plan.costPerDoseUsd,
        };
      }
      const du = num(drawUnits);
      if (!(du > 0)) return null;
      const reverse = doseFromUnits({
        vialMg: vMg,
        bacWaterMl: bacMl,
        insulinUnits: du,
        syringeUnitsPerMl: upm,
      });
      const plan = reconstitutePlan({
        vialMg: vMg,
        bacWaterMl: bacMl,
        desiredDoseMg: reverse.doseMg,
        syringeUnitsPerMl: upm,
        dosesPerWeek: num(dosesPerWeek) > 0 ? num(dosesPerWeek) : undefined,
        vialCostUsd: num(vialCost) > 0 ? num(vialCost) : undefined,
      });
      return {
        drawMl: reverse.drawMl,
        effDoseMg: reverse.doseMg,
        units: du,
        dosesPerVial: plan.dosesPerVial,
        daysOfSupply: plan.daysOfSupply,
        costPerDose: plan.costPerDoseUsd,
      };
    } catch {
      return null;
    }
  }, [concentration, mode, doseMg, drawUnits, upm, vMg, bacMl, dosesPerWeek, vialCost]);

  // Syringe tick/fill model from the shared pure function.
  const syringe = useMemo(
    () =>
      calc
        ? syringeModel({
            syringeUnitsPerMl: upm,
            barrelCapacityUnits: num(barrel),
            fillUnits: calc.units,
          })
        : null,
    [calc, upm, barrel],
  );

  // Per-component delivery for blends — drawMl × (component mg / total water).
  const blendDelivery = useMemo(() => {
    if (!selected?.is_blend || !calc || bacMl <= 0) return null;
    return (selected.component_mg ?? [])
      .filter((c) => typeof c.mg === "number" && c.mg !== null)
      .map((c) => ({
        label: c.label,
        mg: c.mg as number,
        deliveredMg: calc.drawMl * ((c.mg as number) / bacMl),
      }));
  }, [selected, calc, bacMl]);

  const mgPerUnit = concentration > 0 ? concentration / upm : 0;
  const quickFills =
    selected?.ref_dose && (selected.ref_dose.unit === "mg" || selected.ref_dose.unit === "mcg")
      ? Array.from(
          new Set([
            selected.ref_dose.low,
            (selected.ref_dose.low + selected.ref_dose.high) / 2,
            selected.ref_dose.high,
          ]),
        )
      : null;

  async function saveMix() {
    if (!calc) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reconstitution/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compound_id: compoundId || null,
          label: selected?.name ?? null,
          vial_mg: vMg,
          bac_water_ml: bacMl,
          concentration_mg_per_ml: concentration,
          desired_dose_mg: calc.effDoseMg,
          syringe_units_per_ml: upm,
          draw_ml: calc.drawMl,
          insulin_units: calc.units,
          vial_cost_usd: vialCost === "" ? null : num(vialCost),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(b.error?.message ?? "Could not save");
      }
      toast.success("Mix saved to your history.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* STEP 1 — product + reconstitution */}
      <Card title="1 · Product & reconstitution">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Peptide / blend</Label>
            <CompoundPicker options={options} value={slug} onChange={setSlug} />
            {!selected?.ref_dose ? (
              <p className="text-2xs text-[var(--fg-subtle)]">
                Pick one to load its vial size + reference dose.
              </p>
            ) : null}
          </div>

          {selected?.ref_dose ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs leading-[1.5] text-[var(--fg-muted)]">
                Reference:{" "}
                <span className="font-medium text-[var(--fg)]">
                  {selected.ref_dose.low}
                  {selected.ref_dose.high !== selected.ref_dose.low ? `–${selected.ref_dose.high}` : ""}{" "}
                  {selected.ref_dose.unit}
                </span>{" "}
                — educational start from public literature, override freely.
              </p>
              <EvidenceBadge level={selected.ref_dose.evidence_level} fdaApproved={false} />
            </div>
          ) : null}
          {selected?.is_blend && selected.component_mg.length > 0 ? (
            <p className="text-xs leading-[1.5] text-[var(--fg-muted)]">
              Composition:{" "}
              <span className="text-[var(--fg)]">
                {selected.component_mg
                  .map((c) => `${c.label}${c.mg !== null ? ` ${c.mg} mg` : ""}`)
                  .join(" / ")}
              </span>
              {selected.typical_vial_mg ? ` · ${selected.typical_vial_mg} mg total` : ""}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{selected?.is_blend ? "Vial total (mg)" : "Vial (mg)"}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                value={vialMg}
                onChange={(e) => setVialMg(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>BAC water (mL)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                value={bac}
                onChange={(e) => setBac(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Syringe calibration</Label>
            <Segmented options={CALIBRATIONS} value={unitsPerMl} onChange={setUnitsPerMl} />
          </div>
          <div className="space-y-2">
            <Label>Barrel size</Label>
            <Segmented options={BARRELS} value={barrel} onChange={setBarrel} />
          </div>

          <div className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div>
              <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>
                Concentration
              </Overline>
              <div
                className="mt-1 font-[family-name:var(--font-mono)] text-2xl tabular-nums"
                style={{ fontWeight: 500, letterSpacing: "-0.02em", color: "var(--primary-bright)" }}
              >
                {concentration > 0 ? concentration.toFixed(3) : "—"}
                <span className="ml-1 text-2xs font-normal text-[var(--fg-subtle)]">mg/mL</span>
              </div>
            </div>
            <div className="text-right">
              <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>
                Per syringe unit
              </Overline>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--fg)]">
                {mgPerUnit > 0
                  ? mgPerUnit >= 1
                    ? `${mgPerUnit.toFixed(3)} mg`
                    : `${(mgPerUnit * 1000).toFixed(1)} mcg`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 2 — dose / reverse toggle */}
      <Card title="2 · Dose">
        <div className="space-y-4">
          <Segmented options={MODES} value={mode} onChange={(v) => setMode(v as "dose" | "units")} />

          {mode === "dose" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Desired dose</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={doseUnit === "mcg" ? 1 : 0.05}
                    min={0}
                    value={doseValue}
                    onChange={(e) => setDoseValue(e.target.value)}
                    className="flex-1"
                  />
                  <Segmented
                    options={DOSE_UNITS}
                    value={doseUnit}
                    onChange={(v) => setDoseUnit(v as "mg" | "mcg")}
                  />
                </div>
              </div>
              {quickFills ? (
                <Cluster gap="0.5rem">
                  <span className="text-xs text-[var(--fg-muted)]">Quick fill:</span>
                  {selected?.ref_dose ? (
                    <EvidenceBadge level={selected.ref_dose.evidence_level} fdaApproved={false} />
                  ) : null}
                  {quickFills.map((v) => {
                    const u = selected!.ref_dose!.unit;
                    const rounded = Number(v.toFixed(u === "mcg" ? 0 : 3));
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setDoseUnit(u as "mg" | "mcg");
                          setDoseValue(String(rounded));
                        }}
                        className="rounded-[var(--r-sm)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
                      >
                        {rounded} {u}
                      </button>
                    );
                  })}
                </Cluster>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Units to draw (U-{unitsPerMl})</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0}
                value={drawUnits}
                onChange={(e) => setDrawUnits(e.target.value)}
                className="w-40"
              />
              <p className="text-2xs text-[var(--fg-subtle)]">
                Enter what you drew — we compute the dose it delivers.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Doses / week (opt.)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0}
                placeholder="7 daily, 3.5 EOD"
                value={dosesPerWeek}
                onChange={(e) => setDosesPerWeek(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vial cost $ (opt.)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={1}
                min={0}
                placeholder="cost/dose"
                value={vialCost}
                onChange={(e) => setVialCost(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* RESULT */}
      <Card
        title="Result"
        style={{ borderColor: "var(--primary-line)", background: "var(--primary-wash)" }}
      >
        {!calc ? (
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--danger)]">
            Enter a vial, water, and {mode === "dose" ? "dose" : "units"} (all &gt; 0).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="Injection volume" value={calc.drawMl.toFixed(3)} unit="mL" emphasis />
              <ResultStat label={`Draw to (U-${unitsPerMl})`} value={calc.units.toFixed(1)} unit="u" emphasis />
              <ResultStat label={mode === "units" ? "Delivers" : "Dose"} value={fmtMg(calc.effDoseMg)} />
              <ResultStat label="Doses / vial" value={calc.dosesPerVial.toFixed(1)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat
                label="Days of supply"
                value={calc.daysOfSupply != null ? calc.daysOfSupply.toFixed(0) : "—"}
              />
              {calc.costPerDose != null ? (
                <ResultStat label="Cost / dose" value={`$${calc.costPerDose.toFixed(2)}`} />
              ) : null}
            </div>

            {syringe ? (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <Syringe model={syringe} />
                {syringe.overfilled ? (
                  <p className="text-center text-sm text-[var(--danger)]">
                    Draw exceeds the {syringe.capacityUnits}-unit barrel — use a larger barrel or
                    more diluent.
                  </p>
                ) : null}
              </div>
            ) : null}

            {blendDelivery && blendDelivery.length > 0 ? (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>
                  Per-component delivered at {calc.drawMl.toFixed(3)} mL
                </Overline>
                <div className="mt-2">
                  {blendDelivery.map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-between border-b border-[var(--border)] py-1.5"
                    >
                      <span className="flex-1 text-sm text-[var(--fg)]">{c.label}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{c.mg} mg in vial</span>
                      <span className="ml-3 font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-[var(--fg)]">
                        {fmtMg(c.deliveredMg)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-2xs leading-[1.5] text-[var(--fg-subtle)]">
                  A blend is drawn as one volume; each component is delivered in its fixed ratio.
                  Educational only.
                </p>
              </div>
            ) : null}

            <Button variant="outline" onClick={saveMix} disabled={saving}>
              {saving ? "Saving…" : "Save this mix"}
            </Button>
          </div>
        )}
      </Card>

      {/* Sterile-technique reminder (kept from the simple calculator). */}
      <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-[var(--fg-subtle)]" />
          <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>
            Sterile-technique reminders
          </Overline>
        </div>
        <ul className="mt-2 space-y-1 font-[family-name:var(--font-sans)] text-xs leading-[1.5] text-[var(--fg-muted)]">
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

// --- inline UI helpers -----------------------------------------------------

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-wrap gap-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-[var(--r-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Searchable compound picker — web equivalent of the mobile modal picker. A
// button opens a filterable popover list (blends marked with ★), plus an
// explicit "No compound / custom" entry.
function CompoundPicker({
  options,
  value,
  onChange,
}: {
  options: CompoundOption[];
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.slug === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const itemStyle: CSSProperties = { fontFamily: "var(--font-sans)" };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[42px] w-full items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-[13px] text-left text-[14px] text-[var(--fg)] transition-[border-color] hover:border-[var(--border-strong)]"
      >
        <span className={selected ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]"}>
          {selected ? `${selected.is_blend ? "★ " : ""}${selected.name}` : "Choose a peptide / blend"}
        </span>
        <ChevronDown size={16} className="text-[var(--fg-subtle)]" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size={14} className="text-[var(--fg-subtle)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                style={itemStyle}
              >
                No compound / custom
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.slug);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] ${
                    o.slug === value ? "text-[var(--primary-bright)]" : "text-[var(--fg)]"
                  }`}
                  style={itemStyle}
                >
                  <span>
                    {o.is_blend ? "★ " : ""}
                    {o.name}
                  </span>
                  {o.ref_dose ? (
                    <span
                      className="ml-2 shrink-0 text-2xs text-[var(--fg-subtle)]"
                      title="Literature reference range — not a recommendation"
                    >
                      lit: {o.ref_dose.low}
                      {o.ref_dose.high !== o.ref_dose.low ? `–${o.ref_dose.high}` : ""}{" "}
                      {o.ref_dose.unit}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--fg-subtle)]" style={itemStyle}>
                No matches.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
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
  unit?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>{label}</Overline>
      <div
        className={`mt-1 font-[family-name:var(--font-mono)] tabular-nums ${emphasis ? "text-3xl" : "text-xl"}`}
        style={{
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: emphasis ? "var(--primary-bright)" : "var(--fg)",
        }}
      >
        {value}
        {unit ? <span className="ml-1 text-2xs font-normal text-[var(--fg-subtle)]">{unit}</span> : null}
      </div>
    </div>
  );
}
