import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Loading, EmptyState } from "@/components/ui/States";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { supabase } from "@/lib/supabase";
import { loadInventory, type InventoryView } from "@/lib/inventory";
import { useSession } from "@/lib/session";

interface CatalogCompound {
  id: string;
  name: string;
  typical_vial_mg: number | null;
}

const RANGES = [
  { value: "all", label: "All" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "Year" },
] as const;

const usd = (n: number | null) =>
  n === null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const todayStr = () => new Date().toISOString().slice(0, 10);

function rangeFor(key: string): { from?: string; to?: string } {
  const now = Date.now();
  const to = new Date(now).toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now - 30 * 86400000).toISOString().slice(0, 10), to };
  if (key === "90d") return { from: new Date(now - 90 * 86400000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${new Date(now).getFullYear()}-01-01`, to };
  return {};
}

export default function Inventory() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [rangeKey, setRangeKey] = useState("all");
  const [view, setView] = useState<InventoryView | null>(null);
  const [loading, setLoading] = useState(true);

  const [catalog, setCatalog] = useState<CatalogCompound[]>([]);
  const [query, setQuery] = useState("");
  const [compoundId, setCompoundId] = useState<string | null>(null);
  const [compoundName, setCompoundName] = useState("");
  const [vialMg, setVialMg] = useState("");
  const [vialCount, setVialCount] = useState("1");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setView(await loadInventory(uid, rangeFor(rangeKey)));
    setLoading(false);
  }, [uid, rangeKey]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    supabase
      .from("compounds")
      .select("id, name, typical_vial_mg")
      .order("name")
      .then(({ data }) => setCatalog((data ?? []) as CatalogCompound[]));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, catalog]);

  function pick(c: CatalogCompound) {
    setCompoundId(c.id);
    setCompoundName(c.name);
    setQuery("");
    if (c.typical_vial_mg) setVialMg(String(c.typical_vial_mg));
  }

  async function save() {
    if (!uid || !compoundId) return Alert.alert("Pick a compound", "Choose a compound first.");
    if (!(Number(vialMg) > 0)) return Alert.alert("Vial size", "Enter the vial size in mg.");
    if (price === "" || !(Number(price) >= 0)) return Alert.alert("Price", "Enter the total price.");
    setSaving(true);
    try {
      const { error } = await supabase.from("peptide_purchases").insert({
        user_id: uid,
        compound_id: compoundId,
        vial_mg: Number(vialMg),
        vial_count: Number(vialCount) || 1,
        price_usd: Number(price),
        vendor: vendor.trim() || null,
        purchased_on: /^\d{4}-\d{2}-\d{2}$/.test(purchasedOn) ? purchasedOn : todayStr(),
      });
      if (error) throw error;
      setCompoundId(null);
      setCompoundName("");
      setVialMg("");
      setVialCount("1");
      setPrice("");
      setVendor("");
      setPurchasedOn(todayStr());
      await load();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string, name: string) {
    Alert.alert("Delete purchase", `Delete this ${name} purchase?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!uid) return;
          await supabase.from("peptide_purchases").delete().eq("id", id).eq("user_id", uid);
          load();
        },
      },
    ]);
  }

  if (loading || !view) return <Loading />;

  return (
    <Content className="gap-4">
      <Segmented options={RANGES} value={rangeKey} onChange={setRangeKey} />

      <Card className="gap-3">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-muted-foreground">Spend (range)</Text>
            <Text className="text-lg font-semibold text-foreground">{usd(view.summary.totalUsd)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">$ / lb lost</Text>
            <Text className="text-lg font-semibold text-foreground">{usd(view.summary.costPerLbLostUsd)}</Text>
          </View>
        </View>
        {view.summary.byCompound.length > 0 ? (
          <View className="gap-1 border-t border-border pt-2">
            {view.summary.byCompound.map((b) => (
              <View key={b.compoundId} className="flex-row justify-between">
                <Text className="text-xs text-foreground">
                  {view.purchases.find((p) => p.compound_id === b.compoundId)?.compound_name ?? "—"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {b.avgCostPerMg !== null ? `${usd(b.avgCostPerMg)}/mg · ` : ""}
                  {usd(b.spendUsd)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {view.compounds.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">What&apos;s left</Text>
          {view.compounds.map((c) => (
            <Card key={c.compoundId} className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium text-foreground">{c.name}</Text>
                <Text className="text-xs text-muted-foreground">{num(c.remainingMg)} mg left</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Next dose (FIFO)</Text>
                <Text className="text-xs text-foreground">{usd(c.costOfNextDoseUsd)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Avg / dose · doses left</Text>
                <Text className="text-xs text-foreground">
                  {usd(c.avgCostPerDoseUsd)} · {c.remainingDoses !== null ? num(c.remainingDoses, 0) : "—"}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-foreground">Log a purchase</Text>
        {!compoundId ? (
          <>
            <Field label="Compound">
              <Input value={query} onChangeText={setQuery} placeholder="Search catalog…" autoCapitalize="none" />
            </Field>
            {matches.map((c) => (
              <Pressable key={c.id} onPress={() => pick(c)} className="rounded-lg border border-border bg-muted p-3 active:opacity-70">
                <Text className="text-sm text-foreground">+ {c.name}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-foreground">{compoundName}</Text>
            <Pressable onPress={() => setCompoundId(null)}>
              <Text className="text-sm text-primary">change</Text>
            </Pressable>
          </View>
        )}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Vial (mg)">
              <Input value={vialMg} onChangeText={setVialMg} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Vials">
              <Input value={vialCount} onChangeText={setVialCount} keyboardType="number-pad" placeholder="1" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Total $">
              <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" />
            </Field>
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Vendor (optional)">
              <Input value={vendor} onChangeText={setVendor} placeholder="vendor" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Purchased (YYYY-MM-DD)">
              <Input value={purchasedOn} onChangeText={setPurchasedOn} placeholder={todayStr()} autoCapitalize="none" />
            </Field>
          </View>
        </View>
        <Button title="Log purchase" onPress={save} loading={saving} />
      </Card>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">History</Text>
        {view.purchases.length === 0 ? (
          <EmptyState title="No purchases yet" hint="Log a vial purchase to track spend + cost-per-dose." />
        ) : (
          view.purchases.map((p) => (
            <View key={p.id} className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">{p.compound_name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {p.vial_count}× {p.vial_mg} mg{p.vendor ? ` · ${p.vendor}` : ""} · {new Date(p.purchased_on).toLocaleDateString()}
                </Text>
              </View>
              <Text className="text-sm text-foreground">{usd(p.price_usd)}</Text>
              <Pressable onPress={() => remove(p.id, p.compound_name)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color="#9aa" />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <SafetyDisclaimer variant="compact" />
    </Content>
  );
}
