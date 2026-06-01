import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import {
  reconstitutePlan,
  syringeModel,
  SYRINGE_BARRELS,
  SYRINGE_CALIBRATIONS,
} from "@peptide/peptides/reconstitution";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Syringe } from "@/components/peptides/Syringe";
import { supabase } from "@/lib/supabase";
import { addRegimenItem, patchRegimenItem } from "@/lib/regimen";
import { useSession } from "@/lib/session";
import { useResponsive } from "@/lib/responsive";

interface CatalogCompound {
  id: string;
  name: string;
  typical_route: string | null;
  typical_vial_mg: number | null;
}

const UNITS = [
  { value: "mg", label: "mg" },
  { value: "mcg", label: "mcg" },
  { value: "iu", label: "iu" },
  { value: "units", label: "units" },
] as const;
const ROUTES = [
  { value: "sc", label: "SC" },
  { value: "im", label: "IM" },
  { value: "oral", label: "Oral" },
  { value: "nasal", label: "Nasal" },
  { value: "other", label: "Other" },
] as const;
const INJECTABLE = new Set(["sc", "im"]);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function RegimenItemScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { type } = useResponsive();
  const uid = session?.user.id;
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const isEdit = Boolean(itemId);

  const [catalog, setCatalog] = useState<CatalogCompound[]>([]);
  const [query, setQuery] = useState("");
  const [compoundId, setCompoundId] = useState<string | null>(null);
  const [compoundName, setCompoundName] = useState("");

  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [route, setRoute] = useState("sc");
  const [frequency, setFrequency] = useState("daily");

  const [vialMg, setVialMg] = useState("");
  const [bacMl, setBacMl] = useState("2");
  const [unitsPerMl, setUnitsPerMl] = useState(100);
  const [barrel, setBarrel] = useState(100);
  const [attachMix, setAttachMix] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("compounds")
      .select("id, name, typical_route, typical_vial_mg")
      .order("name")
      .then(({ data }) => setCatalog((data ?? []) as CatalogCompound[]));
  }, []);

  // Edit mode → load the existing item.
  useEffect(() => {
    if (!isEdit || !itemId) return;
    supabase
      .from("regimen_items")
      .select("compound_id, dose_value, dose_unit, route, frequency, compounds ( name )")
      .eq("id", itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        setCompoundId(d.compound_id);
        const c = Array.isArray(d.compounds) ? d.compounds[0] : d.compounds;
        setCompoundName(c?.name ?? "");
        if (d.dose_value !== null) setDose(String(d.dose_value));
        if (d.dose_unit) setDoseUnit(d.dose_unit);
        if (d.route) setRoute(d.route);
        if (d.frequency) setFrequency(d.frequency);
      });
  }, [isEdit, itemId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, catalog]);

  function pick(c: CatalogCompound) {
    setCompoundId(c.id);
    setCompoundName(c.name);
    setQuery("");
    if (c.typical_route) setRoute(c.typical_route);
    if (c.typical_vial_mg) setVialMg(String(c.typical_vial_mg));
  }

  const desiredDoseMg = useMemo(() => {
    const v = Number(dose);
    if (!v || v <= 0) return null;
    if (doseUnit === "mg") return v;
    if (doseUnit === "mcg") return v / 1000;
    return null;
  }, [dose, doseUnit]);

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

  const syr = useMemo(() => {
    if (!plan || plan.insulinUnits === null) return null;
    return syringeModel({ syringeUnitsPerMl: unitsPerMl, barrelCapacityUnits: barrel, fillUnits: plan.insulinUnits });
  }, [plan, unitsPerMl, barrel]);

  async function save() {
    if (!uid) return;
    if (!compoundId) return Alert.alert("Pick a compound", "Choose a compound first.");
    setSaving(true);
    const reconstitution =
      attachMix && plan
        ? {
            vial_mg: Number(vialMg),
            bac_water_ml: Number(bacMl),
            concentration_mg_per_ml: plan.concentrationMgPerMl,
            desired_dose_mg: desiredDoseMg,
            syringe_units_per_ml: unitsPerMl,
            draw_ml: plan.drawMl,
            insulin_units: plan.insulinUnits,
          }
        : null;
    const doseFields = {
      dose_value: dose ? Number(dose) : null,
      dose_unit: dose ? doseUnit : null,
      route,
      frequency: frequency.trim() || null,
    };
    try {
      if (isEdit && itemId) {
        await patchRegimenItem(uid, itemId, { ...doseFields, reconstitution: reconstitution ?? undefined });
        Alert.alert("Updated", `${compoundName} updated.`);
      } else {
        await addRegimenItem(uid, {
          compound_id: compoundId,
          ...doseFields,
          starts_on: todayStr(),
          notes: null,
          reconstitution,
        });
        Alert.alert("Added", `${compoundName} added to your regimen.`);
      }
      router.back();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Content className="gap-4">
      {!compoundId ? (
        <Card className="gap-3">
          <Field label="Add compound">
            <Input value={query} onChangeText={setQuery} placeholder="Search catalog…" autoCapitalize="none" />
          </Field>
          {matches.map((c) => (
            <Pressable key={c.id} onPress={() => pick(c)} className="rounded-lg border border-border bg-muted p-3 active:opacity-70">
              <Text className="text-sm text-foreground">+ {c.name}</Text>
            </Pressable>
          ))}
        </Card>
      ) : (
        <>
          <Card className="gap-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 font-semibold text-foreground" style={{ fontSize: type.lg }}>{compoundName}</Text>
              {!isEdit ? (
                <Pressable onPress={() => setCompoundId(null)} style={{ flexShrink: 0 }}>
                  <Text className="text-sm text-primary">change</Text>
                </Pressable>
              ) : null}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Dose">
                  <Input value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="—" />
                </Field>
              </View>
              <View className="flex-[1.4]">
                <Field label="Unit">
                  <Segmented options={UNITS} value={doseUnit} onChange={setDoseUnit} />
                </Field>
              </View>
            </View>
            <Field label="Route">
              <Segmented options={ROUTES} value={route} onChange={setRoute} />
            </Field>
            <Field label="Frequency">
              <Input value={frequency} onChangeText={setFrequency} placeholder="daily, EOD, 2x/week…" />
            </Field>
            <Text className="text-xs text-muted-foreground">
              You or your clinician decide the dose. RecompIQ does not prescribe.
            </Text>
          </Card>

          {INJECTABLE.has(route) ? (
            <Card className="gap-3">
              <Text className="text-sm font-semibold text-foreground">Reconstitution</Text>
              {desiredDoseMg === null ? (
                <Text className="text-xs text-muted-foreground">Enter a dose in mg or mcg to compute the draw.</Text>
              ) : (
                <>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Field label="Vial (mg)">
                        <Input value={vialMg} onChangeText={setVialMg} keyboardType="decimal-pad" placeholder="0" />
                      </Field>
                    </View>
                    <View className="flex-1">
                      <Field label="BAC water (mL)">
                        <Input value={bacMl} onChangeText={setBacMl} keyboardType="decimal-pad" placeholder="0" />
                      </Field>
                    </View>
                  </View>
                  <Field label="Syringe">
                    <Segmented
                      options={SYRINGE_CALIBRATIONS.map((s) => ({ value: String(s.unitsPerMl), label: `U-${s.unitsPerMl}` }))}
                      value={String(unitsPerMl)}
                      onChange={(v) => setUnitsPerMl(Number(v))}
                    />
                  </Field>
                  <Field label="Barrel">
                    <Segmented
                      options={SYRINGE_BARRELS.map((b) => ({ value: String(b.capacityUnits), label: `${b.capacityUnits}u` }))}
                      value={String(barrel)}
                      onChange={(v) => setBarrel(Number(v))}
                    />
                  </Field>
                  {plan ? (
                    <View className="gap-2">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted-foreground">Concentration</Text>
                        <Text className="text-xs text-foreground">{plan.concentrationMgPerMl.toFixed(2)} mg/mL</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted-foreground">Draw</Text>
                        <Text className="text-xs text-foreground">
                          {plan.insulinUnits !== null
                            ? `${plan.insulinUnits.toFixed(1)} units (${plan.drawMl.toFixed(3)} mL)`
                            : `${plan.drawMl.toFixed(3)} mL`}
                        </Text>
                      </View>
                      {syr ? <Syringe model={syr} /> : null}
                      <Pressable onPress={() => setAttachMix((v) => !v)} className="flex-row items-center gap-2">
                        <View className={`h-4 w-4 rounded border ${attachMix ? "border-primary bg-primary" : "border-border"}`} />
                        <Text className="text-xs text-muted-foreground">Attach this mix to the item</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}

          <Button title={isEdit ? "Save changes" : "Add to regimen"} onPress={save} loading={saving} />
        </>
      )}
    </Content>
  );
}
