import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

interface CatalogCompound {
  id: string;
  name: string;
}
interface ItemDraft {
  compound_id: string;
  name: string;
  dose_value: string;
  dose_unit: string;
  route: string;
  frequency: string;
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

export default function NewStack() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const [catalog, setCatalog] = useState<CatalogCompound[]>([]);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState("P1");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("compounds").select("id, name").order("name").then(({ data }) => setCatalog((data ?? []) as CatalogCompound[]));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(items.map((i) => i.compound_id));
    return catalog.filter((c) => c.name.toLowerCase().includes(q) && !chosen.has(c.id)).slice(0, 6);
  }, [query, catalog, items]);

  function addItem(c: CatalogCompound) {
    setItems((prev) => [...prev, { compound_id: c.id, name: c.name, dose_value: "", dose_unit: "mg", route: "sc", frequency: "daily" }]);
    setQuery("");
  }
  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!uid) return;
    if (!name.trim()) return Alert.alert("Name required", "Give the stack a name.");
    const valid = items.filter((i) => Number(i.dose_value) > 0);
    if (valid.length === 0) return Alert.alert("Add a compound", "Add at least one compound with a dose.");
    setSaving(true);
    try {
      const { data: stack, error: sErr } = await supabase
        .from("peptide_stacks")
        .insert({ user_id: uid, name: name.trim(), phase, is_active: true })
        .select("id")
        .single();
      if (sErr) throw sErr;
      const rows = valid.map((i) => ({
        stack_id: stack.id,
        user_id: uid,
        compound_id: i.compound_id,
        dose_value: Number(i.dose_value),
        dose_unit: i.dose_unit,
        route: i.route,
        frequency: i.frequency || "daily",
      }));
      const { error: iErr } = await supabase.from("peptide_stack_items").insert(rows);
      if (iErr) throw iErr;
      Alert.alert("Stack created", `${name.trim()} saved.`);
      router.back();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Content className="gap-4">
      <Card className="gap-4">
        <Field label="Stack name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Phase 1 fat loss" />
        </Field>
        <Field label="Phase">
          <Segmented
            options={[
              { value: "P1", label: "P1" },
              { value: "P2", label: "P2" },
              { value: "P3", label: "P3" },
            ]}
            value={phase}
            onChange={setPhase}
          />
        </Field>
      </Card>

      <Card className="gap-3">
        <Field label="Add compound">
          <Input value={query} onChangeText={setQuery} placeholder="Search catalog…" autoCapitalize="none" />
        </Field>
        {matches.map((c) => (
          <Pressable key={c.id} onPress={() => addItem(c)} className="rounded-lg border border-border bg-muted p-3 active:opacity-70">
            <Text className="text-sm text-foreground">+ {c.name}</Text>
          </Pressable>
        ))}
      </Card>

      {items.map((it, idx) => (
        <Card key={it.compound_id} className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">{it.name}</Text>
            <Pressable onPress={() => removeItem(idx)}>
              <Text className="text-sm text-destructive">Remove</Text>
            </Pressable>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Dose">
                <Input value={it.dose_value} onChangeText={(v) => updateItem(idx, { dose_value: v })} keyboardType="decimal-pad" placeholder="0" />
              </Field>
            </View>
            <View className="flex-[1.4]">
              <Field label="Unit">
                <Segmented options={UNITS} value={it.dose_unit} onChange={(v) => updateItem(idx, { dose_unit: v })} />
              </Field>
            </View>
          </View>
          <Field label="Route">
            <Segmented options={ROUTES} value={it.route} onChange={(v) => updateItem(idx, { route: v })} />
          </Field>
          <Field label="Frequency">
            <Input value={it.frequency} onChangeText={(v) => updateItem(idx, { frequency: v })} placeholder="daily, EOD, 2x/week…" />
          </Field>
        </Card>
      ))}

      <Button title="Create stack" onPress={save} loading={saving} />
    </Content>
  );
}
