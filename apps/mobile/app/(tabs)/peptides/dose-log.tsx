import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Loading, EmptyState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { loadActiveRegimen } from "@/lib/regimen";
import { useSession } from "@/lib/session";
import { useResponsive } from "@/lib/responsive";

interface Item {
  id: string;
  compound_id: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  compoundName: string;
}
interface Dose {
  id: string;
  taken_at: string;
  dose_value: number;
  dose_unit: string;
  adherence: string;
  compounds: { name: string } | null;
}

const ADHERENCE = [
  { value: "taken", label: "Taken" },
  { value: "partial", label: "Partial" },
  { value: "skipped", label: "Skipped" },
] as const;

export default function DoseLog() {
  const { session } = useSession();
  const { type } = useResponsive();
  const uid = session?.user.id;
  const [items, setItems] = useState<Item[]>([]);
  const [recent, setRecent] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [adherence, setAdherence] = useState("taken");
  const [site, setSite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const [regimen, { data: doses }] = await Promise.all([
      loadActiveRegimen(uid),
      supabase
        .from("peptide_doses")
        .select("id, taken_at, dose_value, dose_unit, adherence, compounds ( name )")
        .gte("taken_at", since)
        .order("taken_at", { ascending: false })
        .limit(60),
    ]);
    // Loggable items = current regimen items with a decided dose + route.
    const flat: Item[] = (regimen?.currentItems ?? [])
      .filter((it) => it.compound && it.dose_value !== null && it.dose_unit && it.route)
      .map((it) => ({
        id: it.id,
        compound_id: it.compound_id,
        dose_value: it.dose_value as number,
        dose_unit: it.dose_unit as string,
        route: it.route as string,
        compoundName: it.compound!.name,
      }));
    setItems(flat);
    if (flat.length && !selected) setSelected(flat[0].id);
    setRecent((doses ?? []) as unknown as Dose[]);
    setLoading(false);
  }, [uid, selected]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const item = items.find((i) => i.id === selected);
    if (!uid || !item) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("peptide_doses").insert({
        user_id: uid,
        regimen_item_id: item.id,
        compound_id: item.compound_id,
        dose_value: item.dose_value,
        dose_unit: item.dose_unit,
        route: item.route,
        adherence,
        injection_site: site || null,
        notes: notes || null,
      });
      if (error) throw error;
      setSite("");
      setNotes("");
      Alert.alert("Logged", `${item.compoundName} marked ${adherence}.`);
      await load();
    } catch (e) {
      Alert.alert("Could not log", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Content className="gap-4">
      {items.length === 0 ? (
        <EmptyState title="No loggable compounds" hint="Add a compound with a set dose to your regimen first." />
      ) : (
        <Card className="gap-4">
          <Field label="Compound">
            <View className="gap-2">
              {items.map((it) => {
                const active = it.id === selected;
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => setSelected(it.id)}
                    className={`flex-row items-center justify-between gap-2 rounded-lg border p-3 ${active ? "border-primary bg-muted" : "border-border bg-card"}`}
                  >
                    <Text numberOfLines={1} className="flex-1 text-sm font-medium text-foreground">{it.compoundName}</Text>
                    <Text className="text-sm text-muted-foreground" style={{ flexShrink: 0 }}>{it.dose_value} {it.dose_unit} · {it.route}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
          <Field label="Adherence">
            <Segmented options={ADHERENCE} value={adherence} onChange={setAdherence} />
          </Field>
          <Field label="Injection site (optional)">
            <Input value={site} onChangeText={setSite} placeholder="e.g. left abdomen" />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChangeText={setNotes} placeholder="anything notable" />
          </Field>
          <Button title="Log dose" onPress={save} loading={saving} />
        </Card>
      )}

      <View className="gap-2">
        <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>Recent (14 days)</Text>
        {recent.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No doses logged yet.</Text>
        ) : (
          recent.map((d) => (
            <View key={d.id} className="flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-medium text-foreground">{d.compounds?.name ?? "—"}</Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(d.taken_at).toLocaleDateString()} · {d.dose_value} {d.dose_unit}
                </Text>
              </View>
              <Pill
                label={d.adherence}
                tone={d.adherence === "taken" ? "accent" : d.adherence === "skipped" ? "destructive" : "default"}
              />
            </View>
          ))
        )}
      </View>
    </Content>
  );
}
