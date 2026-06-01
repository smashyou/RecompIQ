import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  evaluateContraindications,
  type ContraindicationFinding,
  type UserHealthSnapshot,
} from "@peptide/peptides/contraindications";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Loading, EmptyState } from "@/components/ui/States";
import { ContraindicationBanner } from "@/components/peptides/ContraindicationBanner";
import { useResponsive } from "@/lib/responsive";
import {
  loadActiveRegimen,
  stopRegimenItem,
  advanceRegimenPhase,
  type ActiveRegimen,
  type RegimenItem,
} from "@/lib/regimen";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export default function PeptidesHub() {
  const router = useRouter();
  const { session } = useSession();
  const { type } = useResponsive();
  const uid = session?.user.id;
  const [regimen, setRegimen] = useState<ActiveRegimen | null>(null);
  const [findings, setFindings] = useState<ContraindicationFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    const [reg, { data: condData }, { data: medData }, { data: profile }] = await Promise.all([
      loadActiveRegimen(uid),
      supabaseSelect("conditions"),
      supabaseSelect("medications"),
      supabaseProfile(uid),
    ]);
    setRegimen(reg);

    const snapshot: UserHealthSnapshot = {
      conditions: (condData ?? []).map((c: { name: string }) => c.name),
      medications: (medData ?? []).map((m: { name: string }) => m.name),
      age: ageFromDob(profile?.dob ?? null),
      sex: profile?.sex ?? null,
    };
    const all: ContraindicationFinding[] = [];
    const seen = new Set<string>();
    for (const it of reg?.currentItems ?? []) {
      if (!it.compound) continue;
      for (const f of evaluateContraindications(it.compound, snapshot)) {
        const key = `${f.compoundSlug}:${f.severity}:${f.reason}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(f);
        }
      }
    }
    setFindings(all);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function onStop(item: RegimenItem) {
    Alert.alert("Stop compound", `Mark ${item.compound?.name ?? "this item"} as ended today?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          if (!uid) return;
          try {
            await stopRegimenItem(uid, item.id);
            load();
          } catch {
            Alert.alert("Error", "Could not stop item.");
          }
        },
      },
    ]);
  }

  function onAdvance() {
    Alert.prompt?.("Advance phase", "Name the new phase. The current phase ends today.", async (name) => {
      if (!uid || !name?.trim()) return;
      try {
        await advanceRegimenPhase(uid, name.trim());
        load();
      } catch {
        Alert.alert("Error", "Could not advance phase.");
      }
    });
  }

  if (loading) return <Loading />;

  const phases = regimen?.phases ?? [];

  return (
    <Content className="gap-4">
      <ContraindicationBanner findings={findings} />

      <View className="flex-row gap-2">
        <Button
          title="Add to regimen"
          onPress={() => router.push("/(tabs)/peptides/stacks-new")}
          className="flex-1"
        />
        <Button title="Advance phase" variant="outline" onPress={onAdvance} className="flex-1" />
      </View>

      <View className="gap-2">
        <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>Your regimen</Text>
        {phases.length === 0 ? (
          <EmptyState title="Regimen is empty" hint="Add the compounds you and your clinician have decided on." />
        ) : (
          phases.map((p) => {
            const isCurrent = p.ends_on === null;
            return (
              <Card key={p.id} className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Text
                    numberOfLines={1}
                    className="flex-1 font-semibold text-foreground"
                    style={{ fontSize: type.lg }}
                  >
                    {p.name}
                  </Text>
                  {p.legacy_phase ? <Pill label={p.legacy_phase} /> : null}
                  {isCurrent ? <Pill label="current" tone="primary" /> : null}
                </View>
                {p.items.length === 0 ? (
                  <Text className="text-xs text-muted-foreground">No compounds in this phase.</Text>
                ) : (
                  p.items.map((it) => (
                    <View key={it.id} className="flex-row items-start gap-2 border-t border-border pt-2">
                      <View className="flex-1 gap-1">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-medium text-foreground"
                        >
                          {it.compound?.name ?? "—"}
                        </Text>
                        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                          {it.compound ? (
                            <EvidenceBadge level={it.compound.evidence_level as never} />
                          ) : null}
                          <Text className="text-xs text-muted-foreground">
                            {it.dose_value !== null
                              ? `${it.dose_value} ${it.dose_unit ?? ""} · ${it.route ?? ""} · ${it.frequency ?? ""}`
                              : "dose not set"}
                          </Text>
                        </View>
                      </View>
                      {isCurrent ? (
                        <View className="flex-row items-center gap-3 pt-0.5">
                          <Pressable
                            onPress={() =>
                              router.push({
                                pathname: "/(tabs)/peptides/stacks-new",
                                params: { itemId: it.id },
                              })
                            }
                            hitSlop={8}
                          >
                            <Ionicons name="pencil-outline" size={18} color="#9aa" />
                          </Pressable>
                          <Pressable onPress={() => onStop(it)} hitSlop={8}>
                            <Ionicons name="stop-circle-outline" size={18} color="#9aa" />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
            );
          })
        )}
      </View>

      <View className="gap-2">
        <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>Tools</Text>
        <ListRow title="Compound Catalog" subtitle="All compounds + safety data" icon="list-outline" onPress={() => router.push("/(tabs)/peptides/compounds")} />
        <ListRow title="Protocol Library" subtitle="Evidence-graded dose references" icon="library-outline" onPress={() => router.push("/(tabs)/peptides/library")} />
        <ListRow title="Reconstitution" subtitle="Vial math + syringe draw" icon="flask-outline" onPress={() => router.push("/(tabs)/peptides/reconstitution")} />
        <ListRow title="Protocols" subtitle="Titration schedules + reference" icon="calendar-outline" onPress={() => router.push("/(tabs)/peptides/protocols")} />
        <ListRow title="Dose Log" subtitle="Record doses taken" icon="checkmark-done-outline" onPress={() => router.push("/(tabs)/peptides/dose-log")} />
        <ListRow title="Inventory & Spend" subtitle="Purchases, cost-per-dose, expenses" icon="wallet-outline" onPress={() => router.push("/(tabs)/peptides/inventory")} />
      </View>
    </Content>
  );
}

// Small inline supabase helpers kept local to avoid widening lib/regimen surface.
async function supabaseSelect(table: "conditions" | "medications") {
  return supabase.from(table).select("name").eq("active", true);
}
async function supabaseProfile(uid: string) {
  return supabase.from("profiles").select("dob, sex").eq("user_id", uid).maybeSingle();
}
