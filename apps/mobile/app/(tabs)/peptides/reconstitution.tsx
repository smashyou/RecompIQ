import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EvidenceLevel } from "@peptide/shared";
import { syringeModel, SYRINGE_BARRELS } from "@peptide/peptides/reconstitution";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { Segmented } from "@/components/ui/Segmented";
import { StatBox } from "@/components/ui/StatBox";
import { Syringe } from "@/components/peptides/Syringe";
import { CompoundPicker } from "@/components/peptides/CompoundPicker";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { usePeptideSelection } from "@/lib/peptide-selection";
import { colors } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

interface Option {
  id: string;
  slug: string;
  name: string;
  is_blend: boolean;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[];
  ref_dose: { low: number; high: number; unit: string; evidence_level: EvidenceLevel } | null;
}

const CALIBRATIONS = [
  { value: "100", label: "U-100" },
  { value: "50", label: "U-50" },
  { value: "40", label: "U-40" },
];
const BARRELS = SYRINGE_BARRELS.map((b) => ({ value: String(b.capacityUnits), label: b.label.replace(/ \(.*\)/, "") }));
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

export default function Reconstitution() {
  const { compound: compoundSlug } = useLocalSearchParams<{ compound?: string }>();
  const router = useRouter();
  const { type } = useResponsive();
  const sel = usePeptideSelection();
  const [options, setOptions] = useState<Option[]>([]);
  // Selected compound is the shared peptide-section selection (by slug).
  const compoundId = useMemo(() => options.find((o) => o.slug === sel.slug)?.id ?? "", [options, sel.slug]);

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

  // Load compound options (vial size + composition + reference dose).
  useEffect(() => {
    (async () => {
      const [{ data: comps }, { data: refs }] = await Promise.all([
        supabase.from("compounds").select("id, slug, name, is_blend, typical_vial_mg, component_mg").order("name"),
        supabase.from("compound_dose_reference").select("compound_id, low_value, high_value, unit, is_human_data, evidence_level"),
      ]);
      const refDose = new Map<string, { low: number; high: number; unit: string; evidence_level: EvidenceLevel }>();
      for (const r of (refs ?? []) as any[]) {
        if (r.low_value == null) continue;
        const existing = refDose.get(r.compound_id);
        if (!existing || r.is_human_data) {
          refDose.set(r.compound_id, { low: Number(r.low_value), high: Number(r.high_value ?? r.low_value), unit: r.unit, evidence_level: r.evidence_level });
        }
      }
      const opts: Option[] = ((comps ?? []) as any[]).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        is_blend: c.is_blend ?? false,
        typical_vial_mg: c.typical_vial_mg,
        component_mg: c.component_mg ?? [],
        ref_dose: refDose.get(c.id) ?? null,
      }));
      setOptions(opts);
    })();
  }, []);

  // Deep-link (?compound=slug) initializes the shared selection.
  useEffect(() => {
    if (compoundSlug) sel.setSlug(compoundSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundSlug]);

  const selected = options.find((o) => o.id === compoundId) ?? null;

  // On selection, load typical vial + reference dose (mirrors web).
  useEffect(() => {
    if (!selected) return;
    if (selected.typical_vial_mg && selected.typical_vial_mg > 0) setVialMg(String(selected.typical_vial_mg));
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

  const calc = useMemo(() => {
    if (concentration <= 0) return null;
    let drawMl: number, effDoseMg: number, units: number;
    if (mode === "dose") {
      if (!(doseMg > 0)) return null;
      effDoseMg = doseMg;
      drawMl = effDoseMg / concentration;
      units = drawMl * upm;
    } else {
      const du = num(drawUnits);
      if (!(du > 0)) return null;
      units = du;
      drawMl = du / upm;
      effDoseMg = drawMl * concentration;
    }
    if (!(drawMl > 0)) return null;
    const dosesPerVial = vMg / effDoseMg;
    const dpw = num(dosesPerWeek);
    const daysOfSupply = dpw > 0 ? (dosesPerVial * 7) / dpw : null;
    const cost = num(vialCost);
    const costPerDose = cost > 0 ? cost / dosesPerVial : null;
    return { drawMl, effDoseMg, units, dosesPerVial, daysOfSupply, costPerDose };
  }, [concentration, mode, doseMg, drawUnits, upm, vMg, dosesPerWeek, vialCost]);

  const syringe = useMemo(
    () => (calc ? syringeModel({ syringeUnitsPerMl: upm, barrelCapacityUnits: num(barrel), fillUnits: calc.units }) : null),
    [calc, upm, barrel],
  );

  const blendDelivery = useMemo(() => {
    if (!selected?.is_blend || !calc || bacMl <= 0) return null;
    return (selected.component_mg ?? [])
      .filter((c) => typeof c.mg === "number" && c.mg !== null)
      .map((c) => ({ label: c.label, mg: c.mg as number, deliveredMg: calc.drawMl * ((c.mg as number) / bacMl) }));
  }, [selected, calc, bacMl]);

  const mgPerUnit = concentration > 0 ? concentration / upm : 0;
  const quickFills =
    selected?.ref_dose && (selected.ref_dose.unit === "mg" || selected.ref_dose.unit === "mcg")
      ? Array.from(new Set([selected.ref_dose.low, (selected.ref_dose.low + selected.ref_dose.high) / 2, selected.ref_dose.high]))
      : null;

  async function saveMix() {
    if (!calc) return;
    setSaving(true);
    try {
      await apiFetch("/api/reconstitution/records", {
        method: "POST",
        body: JSON.stringify({
          compound_id: compoundId || null,
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
      Alert.alert("Saved", "Mix saved to your history.");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Content className="gap-4">
      {/* STEP 1 — product + reconstitution */}
      <Card className="gap-4">
        <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>1 · Product & reconstitution</Text>

        <Field label="Peptide / blend" hint={selected?.ref_dose ? undefined : "Pick one to load its vial size + reference dose."}>
          <CompoundPicker
            options={options}
            value={compoundId}
            onChange={(id) => sel.setSlug(options.find((o) => o.id === id)?.slug ?? null)}
          />
        </Field>

        {selected?.ref_dose ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              Reference:{" "}
              <Text className="font-medium text-foreground">
                {selected.ref_dose.low}
                {selected.ref_dose.high !== selected.ref_dose.low ? `–${selected.ref_dose.high}` : ""} {selected.ref_dose.unit}
              </Text>{" "}
              — educational start, override freely.
            </Text>
            <EvidenceBadge level={selected.ref_dose.evidence_level} />
          </View>
        ) : null}
        {selected?.is_blend && selected.component_mg.length > 0 ? (
          <Text className="text-xs text-muted-foreground">
            Composition:{" "}
            <Text className="text-foreground">
              {selected.component_mg.map((c) => `${c.label}${c.mg !== null ? ` ${c.mg} mg` : ""}`).join(" / ")}
            </Text>
            {selected.typical_vial_mg ? ` · ${selected.typical_vial_mg} mg total` : ""}
          </Text>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label={selected?.is_blend ? "Vial total (mg)" : "Vial (mg)"}>
              <Input value={vialMg} onChangeText={setVialMg} keyboardType="decimal-pad" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="BAC water (mL)">
              <Input value={bac} onChangeText={setBac} keyboardType="decimal-pad" />
            </Field>
          </View>
        </View>
        <Field label="Syringe calibration">
          <Segmented options={CALIBRATIONS} value={unitsPerMl} onChange={setUnitsPerMl} />
        </Field>
        <Field label="Barrel size">
          <Segmented options={BARRELS} value={barrel} onChange={setBarrel} />
        </Field>

        <View className="flex-row items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
          <View>
            <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">Concentration</Text>
            <Text className="font-semibold text-primary" style={{ fontSize: type.metric }}>
              {concentration > 0 ? concentration.toFixed(3) : "—"}
              <Text className="text-xs font-normal text-muted-foreground"> mg/mL</Text>
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">Per syringe unit</Text>
            <Text className="text-sm font-medium text-foreground">
              {mgPerUnit > 0 ? (mgPerUnit >= 1 ? `${mgPerUnit.toFixed(3)} mg` : `${(mgPerUnit * 1000).toFixed(1)} mcg`) : "—"}
            </Text>
          </View>
        </View>
      </Card>

      {/* STEP 2 — dose / reverse toggle */}
      <Card className="gap-4">
        <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>2 · Dose</Text>
        <Segmented options={MODES} value={mode} onChange={setMode} />

        {mode === "dose" ? (
          <View className="gap-3">
            <Field label="Desired dose">
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Input value={doseValue} onChangeText={setDoseValue} keyboardType="decimal-pad" />
                </View>
                <Segmented options={DOSE_UNITS} value={doseUnit} onChange={setDoseUnit} />
              </View>
            </Field>
            {quickFills ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xs text-muted-foreground">Quick fill:</Text>
                {selected?.ref_dose ? <EvidenceBadge level={selected.ref_dose.evidence_level} /> : null}
                {quickFills.map((v) => {
                  const u = selected!.ref_dose!.unit;
                  const rounded = Number(v.toFixed(u === "mcg" ? 0 : 3));
                  return (
                    <Pressable
                      key={v}
                      onPress={() => {
                        setDoseUnit(u as "mg" | "mcg");
                        setDoseValue(String(rounded));
                      }}
                      className="rounded-md border border-border px-2 py-1 active:bg-muted"
                    >
                      <Text className="text-xs text-foreground">{rounded} {u}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : (
          <Field label={`Units to draw (U-${unitsPerMl})`} hint="Enter what you drew — we compute the dose it delivers.">
            <Input value={drawUnits} onChangeText={setDrawUnits} keyboardType="decimal-pad" className="w-40" />
          </Field>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Doses / week (opt.)">
              <Input value={dosesPerWeek} onChangeText={setDosesPerWeek} keyboardType="decimal-pad" placeholder="7 daily, 3.5 EOD" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Vial cost $ (opt.)">
              <Input value={vialCost} onChangeText={setVialCost} keyboardType="decimal-pad" placeholder="cost/dose" />
            </Field>
          </View>
        </View>
      </Card>

      {/* RESULT */}
      <Card className="gap-4 border-primary">
        <Text className="text-sm font-medium uppercase tracking-wider text-primary">Result</Text>
        {!calc ? (
          <Text className="text-sm text-destructive">Enter a vial, water, and dose (all &gt; 0).</Text>
        ) : (
          <>
            <View className="flex-row gap-3">
              <StatBox label="Injection volume" value={`${calc.drawMl.toFixed(3)} mL`} />
              <StatBox label={`Draw to (U-${unitsPerMl})`} value={`${calc.units.toFixed(1)} u`} />
            </View>
            <View className="flex-row flex-wrap gap-3">
              <StatBox label={mode === "units" ? "Delivers" : "Dose"} value={fmtMg(calc.effDoseMg)} />
              <StatBox label="Doses / vial" value={calc.dosesPerVial.toFixed(1)} />
              <StatBox label="Days of supply" value={calc.daysOfSupply != null ? calc.daysOfSupply.toFixed(0) : "—"} />
              {calc.costPerDose != null ? <StatBox label="Cost / dose" value={`$${calc.costPerDose.toFixed(2)}`} /> : null}
            </View>

            {syringe ? (
              <View className="rounded-lg border border-border bg-muted p-3">
                <Syringe model={syringe} />
                {syringe.overfilled ? (
                  <Text className="text-center text-sm text-destructive">
                    Draw exceeds the {syringe.capacityUnits}-unit barrel — use a larger barrel or more diluent.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {blendDelivery && blendDelivery.length > 0 ? (
              <View className="rounded-lg border border-border bg-muted p-3">
                <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Per-component delivered at {calc.drawMl.toFixed(3)} mL
                </Text>
                {blendDelivery.map((c) => (
                  <View key={c.label} className="flex-row items-center justify-between border-b border-border py-1.5">
                    <Text className="flex-1 text-sm text-foreground">{c.label}</Text>
                    <Text className="text-xs text-muted-foreground">{c.mg} mg in vial</Text>
                    <Text className="ml-3 text-sm font-medium text-foreground">{fmtMg(c.deliveredMg)}</Text>
                  </View>
                ))}
                <Text className="mt-2 text-[10px] text-muted-foreground">
                  A blend is drawn as one volume; each component is delivered in its fixed ratio. Educational only.
                </Text>
              </View>
            ) : null}

            <Button title={saving ? "Saving…" : "Save this mix"} variant="outline" onPress={saveMix} disabled={saving} />
          </>
        )}
      </Card>

      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">
          {selected ? `Continue with ${selected.name}` : "Protocols"}
        </Text>
        <NextLink label="Compound reference" icon="book-outline" onPress={() => router.push("/(tabs)/peptides/protocols?tab=reference")} />
        <NextLink label="Build a titration protocol" icon="list-outline" onPress={() => router.push("/(tabs)/peptides/protocols?tab=builder")} />
        <NextLink label="Titration schedules" icon="calendar-outline" onPress={() => router.push("/(tabs)/peptides/protocols?tab=titration")} />
      </Card>

      <SafetyDisclaimer />
    </Content>
  );
}

function NextLink({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between rounded-lg border border-border bg-muted px-3 py-3 active:opacity-70">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}
