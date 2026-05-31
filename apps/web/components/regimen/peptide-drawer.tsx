"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  reconstitutePlan,
  syringeModel,
  evaluateContraindications,
  SYRINGE_BARRELS,
  SYRINGE_CALIBRATIONS,
} from "@peptide/peptides";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { DoseAnnotatedText, DoseDisclaimerFooter } from "@/components/peptides/dose-disclaimer";
import { Overline } from "@/components/kit";
import { SyringeVisual } from "@/app/(app)/peptides/protocols/syringe-visual";

const DOSE_UNITS = ["mg", "mcg", "iu", "ml", "units"] as const;
const ROUTES = ["sc", "im", "iv", "oral", "nasal", "topical", "other"] as const;
const INJECTABLE = new Set(["sc", "im", "iv"]);

export interface DrawerCompound {
  id: string;
  slug: string;
  name: string;
  category: string;
  evidence_level: string;
  fda_approved: boolean;
  typical_route: string | null;
  typical_vial_mg: number | null;
  is_blend: boolean;
  component_slugs: string[];
  component_mg: { label: string; mg: number }[];
  absolute_contraindications: string[];
  relative_contraindications: string[];
  short_description: string | null;
}

export interface ExistingItem {
  id: string;
  compound_id: string;
  compound_name: string;
  compound_slug: string;
  evidence_level: string;
  fda_approved: boolean;
  dose_value: number | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  starts_on: string | null;
  notes: string | null;
}

interface DoseRef {
  id: string;
  context: string;
  route: string | null;
  wrappedText: string;
  evidence_level: string;
  is_human_data: boolean;
}

interface Props {
  open: boolean;
  mode: "add" | "edit";
  item?: ExistingItem | null;
  conditions: string[];
  medications: string[];
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PeptideDrawer({ open, mode, item, conditions, medications, onClose, onSaved }: Props) {
  const router = useRouter();
  const toast = useFireToast();

  const [compounds, setCompounds] = useState<DrawerCompound[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [doseValue, setDoseValue] = useState("");
  const [doseUnit, setDoseUnit] = useState<string>("mg");
  const [route, setRoute] = useState<string>("sc");
  const [frequency, setFrequency] = useState("");
  const [startsOn, setStartsOn] = useState(today());
  const [notes, setNotes] = useState("");

  const [vialMg, setVialMg] = useState("");
  const [bacMl, setBacMl] = useState("2");
  const [unitsPerMl, setUnitsPerMl] = useState(100);
  const [barrel, setBarrel] = useState(100);
  const [attachMix, setAttachMix] = useState(true);

  const [doseRefs, setDoseRefs] = useState<DoseRef[]>([]);
  const [busy, setBusy] = useState(false);

  // Load the catalog once when the sheet opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/compounds")
      .then((r) => r.json())
      .then((b) => {
        if (active && b.data) setCompounds(b.data as DrawerCompound[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  // Seed form state each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && item) {
      setSelectedId(item.compound_id);
      setDoseValue(item.dose_value !== null ? String(item.dose_value) : "");
      setDoseUnit(item.dose_unit ?? "mg");
      setRoute(item.route ?? "sc");
      setFrequency(item.frequency ?? "");
      setStartsOn(item.starts_on ?? today());
      setNotes(item.notes ?? "");
    } else {
      setSelectedId(null);
      setDoseValue("");
      setDoseUnit("mg");
      setRoute("sc");
      setFrequency("");
      setStartsOn(today());
      setNotes("");
    }
    setSearch("");
    setVialMg("");
    setBacMl("2");
    setAttachMix(true);
  }, [open, mode, item]);

  const selected = useMemo(
    () => compounds.find((c) => c.id === selectedId) ?? null,
    [compounds, selectedId],
  );

  // When a compound is picked, default route + vial size + pull literature ranges.
  useEffect(() => {
    if (!selected) return;
    if (mode === "add") {
      if (selected.typical_route) setRoute(selected.typical_route);
      if (selected.typical_vial_mg) setVialMg(String(selected.typical_vial_mg));
    }
    let active = true;
    setDoseRefs([]);
    fetch(`/api/dose-references?slug=${encodeURIComponent(selected.slug)}`)
      .then((r) => r.json())
      .then((b) => {
        if (active && b.data) setDoseRefs(b.data as DoseRef[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return compounds;
    return compounds.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [compounds, search]);

  const findings = useMemo<ReturnType<typeof evaluateContraindications>>(() => {
    if (!selected) return [];
    return evaluateContraindications(
      {
        slug: selected.slug,
        name: selected.name,
        absolute_contraindications: selected.absolute_contraindications ?? [],
        relative_contraindications: selected.relative_contraindications ?? [],
      },
      { conditions, medications, age: null },
    );
  }, [selected, conditions, medications]);

  const hasAbsolute = findings.some((f) => f.severity === "absolute");

  const desiredDoseMg = useMemo(() => {
    const v = Number(doseValue);
    if (!v || v <= 0) return null;
    if (doseUnit === "mg") return v;
    if (doseUnit === "mcg") return v / 1000;
    return null; // iu / ml / units aren't mass-based — recon doesn't apply
  }, [doseValue, doseUnit]);

  const reconReady =
    INJECTABLE.has(route) && desiredDoseMg !== null && Number(vialMg) > 0 && Number(bacMl) > 0;

  const plan = useMemo(() => {
    if (!reconReady) return null;
    try {
      return reconstitutePlan({
        vialMg: Number(vialMg),
        bacWaterMl: Number(bacMl),
        desiredDoseMg: desiredDoseMg as number,
        syringeUnitsPerMl: unitsPerMl,
      });
    } catch {
      return null;
    }
  }, [reconReady, vialMg, bacMl, desiredDoseMg, unitsPerMl]);

  const syringe = useMemo(() => {
    if (!plan || plan.insulinUnits === null) return null;
    return syringeModel({
      syringeUnitsPerMl: unitsPerMl,
      barrelCapacityUnits: barrel,
      fillUnits: plan.insulinUnits,
    });
  }, [plan, unitsPerMl, barrel]);

  async function save(logFirstDose: boolean) {
    if (!selected) {
      toast.error("Pick a compound first.");
      return;
    }
    if (hasAbsolute) {
      toast.error("Absolute contraindication flagged — discuss with your clinician first.");
      return;
    }
    setBusy(true);
    const reconstitution =
      attachMix && plan
        ? {
            compound_id: selected.id,
            vial_mg: Number(vialMg),
            bac_water_ml: Number(bacMl),
            concentration_mg_per_ml: plan.concentrationMgPerMl,
            desired_dose_mg: desiredDoseMg,
            syringe_units_per_ml: unitsPerMl,
            draw_ml: plan.drawMl,
            insulin_units: plan.insulinUnits ?? undefined,
          }
        : undefined;

    const doseFields = {
      dose_value: doseValue ? Number(doseValue) : null,
      dose_unit: doseValue ? doseUnit : null,
      route,
      frequency: frequency.trim() || null,
    };

    let res: Response;
    if (mode === "edit" && item) {
      res = await fetch(`/api/regimen/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...doseFields,
          starts_on: startsOn || null,
          notes: notes.trim() || null,
          reconstitution,
        }),
      });
    } else {
      res = await fetch("/api/regimen/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compound_id: selected.id,
          ...doseFields,
          starts_on: startsOn || null,
          notes: notes.trim() || null,
          reconstitution,
          log_first_dose: logFirstDose,
        }),
      });
    }
    setBusy(false);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides");
      return;
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(b.error?.message ?? "Could not save");
      return;
    }
    toast.success(mode === "edit" ? "Regimen updated" : `${selected.name} added`);
    onSaved();
    router.refresh();
  }

  const footer =
    selected && (mode === "edit" || !!selectedId) ? (
      <div className="flex flex-col gap-2">
        {hasAbsolute && (
          <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--danger,var(--warn))]">
            Absolute contraindication flagged — saving is blocked. Discuss with your clinician.
          </p>
        )}
        <Button onClick={() => save(false)} disabled={busy || hasAbsolute} className="w-full">
          {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add to protocol"}
        </Button>
        {mode === "add" && (
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={busy || hasAbsolute || !doseValue}
            className="w-full"
          >
            Add &amp; log first dose
          </Button>
        )}
      </div>
    ) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit peptide" : "Add to regimen"}
      subtitle="Educational tracking · you or your clinician decide the dose"
      footer={footer}
    >
      {/* STEP 1 — pick a compound (add mode, before selection) */}
      {mode === "add" && !selected && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search compounds & blends"
              className="pl-9"
            />
          </div>
          <ul className="space-y-1.5">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2.5 text-left transition-colors hover:border-[var(--primary-line)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
                        {c.name}
                      </span>
                      {c.is_blend && (
                        <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-px font-[family-name:var(--font-sans)] text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                          blend
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                      {c.is_blend && c.component_slugs.length
                        ? c.component_slugs.join(" · ")
                        : (c.short_description ?? c.category)}
                    </p>
                  </div>
                  <EvidenceBadge level={c.evidence_level as never} fdaApproved={c.fda_approved} />
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] p-4 text-center font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-subtle)]">
                No matches.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* STEPS 2–3 — configure dose + reconstitution */}
      {selected && (
        <div className="space-y-5">
          {/* selected header */}
          <div className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)]">
                {selected.name}
              </span>
              <EvidenceBadge level={selected.evidence_level as never} fdaApproved={selected.fda_approved} />
            </div>
            {mode === "add" && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--primary)] hover:underline"
              >
                change
              </button>
            )}
          </div>

          {/* blend components */}
          {selected.is_blend && selected.component_mg.length > 0 && (
            <div>
              <Overline>Blend components · per-vial composition, not a dose</Overline>
              <ul className="mt-1.5 space-y-1">
                {selected.component_mg.map((cm, i) => (
                  <li
                    key={i}
                    className="flex justify-between rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-muted)]"
                  >
                    <span>{cm.label}</span>
                    <span className="font-[family-name:var(--font-mono)] tabular-nums">{cm.mg} mg</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {findings.length > 0 && <ContraindicationBanner findings={findings} />}

          {/* literature reference ranges (quarantined) */}
          {doseRefs.length > 0 && (
            <div>
              <Overline>Literature ranges · reference only</Overline>
              <ul className="mt-1.5 space-y-1.5">
                {doseRefs.slice(0, 4).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2"
                  >
                    <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                      {r.context}
                    </p>
                    <div className="mt-0.5 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg)]">
                      <DoseAnnotatedText text={r.wrappedText} showFooter={false} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-1.5">
                <DoseDisclaimerFooter />
              </div>
            </div>
          )}

          {/* dose / route / frequency */}
          <div className="space-y-3">
            <Overline>Your protocol</Overline>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Dose</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={doseValue}
                  placeholder="—"
                  onChange={(e) => setDoseValue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Unit</Label>
                <select
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                  className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]"
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
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]"
                >
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Frequency</Label>
                <Input
                  value={frequency}
                  placeholder='"weekly", "EOD"…'
                  onChange={(e) => setFrequency(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Start date</Label>
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Notes</Label>
              <Input value={notes} placeholder="optional" onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* reconstitution step (injectables) */}
          {INJECTABLE.has(route) && (
            <div className="space-y-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
              <Overline>Reconstitution</Overline>
              {desiredDoseMg === null ? (
                <p className="font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                  Enter a dose in mg or mcg to compute the draw volume.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">Vial (mg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        value={vialMg}
                        onChange={(e) => setVialMg(e.target.value)}
                      />
                      {selected.typical_vial_mg !== null &&
                        Number(vialMg) === selected.typical_vial_mg && (
                          <p className="font-[family-name:var(--font-sans)] text-[9.5px] text-[var(--fg-subtle)]">
                            typical vial size — confirm yours
                          </p>
                        )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">BAC water (mL)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        value={bacMl}
                        onChange={(e) => setBacMl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">Syringe</Label>
                      <select
                        value={unitsPerMl}
                        onChange={(e) => setUnitsPerMl(Number(e.target.value))}
                        className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg)]"
                      >
                        {SYRINGE_CALIBRATIONS.map((s) => (
                          <option key={s.unitsPerMl} value={s.unitsPerMl}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">Barrel</Label>
                      <select
                        value={barrel}
                        onChange={(e) => setBarrel(Number(e.target.value))}
                        className="flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-2 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg)]"
                      >
                        {SYRINGE_BARRELS.map((b) => (
                          <option key={b.capacityUnits} value={b.capacityUnits}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {plan && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-[family-name:var(--font-sans)] text-[12px]">
                        <span className="text-[var(--fg-muted)]">Concentration</span>
                        <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                          {plan.concentrationMgPerMl.toFixed(2)} mg/mL
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-[family-name:var(--font-sans)] text-[12px]">
                        <span className="text-[var(--fg-muted)]">Draw</span>
                        <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                          {plan.insulinUnits !== null
                            ? `${plan.insulinUnits.toFixed(1)} units (${plan.drawMl.toFixed(3)} mL)`
                            : `${plan.drawMl.toFixed(3)} mL`}
                        </span>
                      </div>
                      {syringe && <SyringeVisual model={syringe} unitsLabel={`U-${unitsPerMl}`} />}
                      <label className="flex items-center gap-2 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                        <input
                          type="checkbox"
                          checked={attachMix}
                          onChange={(e) => setAttachMix(e.target.checked)}
                        />
                        Attach this mix to the item
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mode === "add" && (
            <p className="flex items-start gap-1.5 font-[family-name:var(--font-sans)] text-[11px] leading-[1.5] text-[var(--fg-subtle)]">
              <Plus size={12} className="mt-0.5 shrink-0" />
              Adds to your current phase. Discuss any protocol change with your clinician.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
