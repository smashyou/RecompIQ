import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Text, View } from "react-native";
import {
  evaluateContraindications,
  type ContraindicationFinding,
  type UserHealthSnapshot,
} from "@peptide/peptides/contraindications";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Loading, EmptyState } from "@/components/ui/States";
import { ContraindicationBanner } from "@/components/peptides/ContraindicationBanner";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

interface StackItem {
  id: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  compounds: {
    slug: string;
    name: string;
    absolute_contraindications: string[];
    relative_contraindications: string[];
  } | null;
}
interface Stack {
  id: string;
  name: string;
  phase: string | null;
  peptide_stack_items: StackItem[];
}

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
  const uid = session?.user.id;
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [findings, setFindings] = useState<ContraindicationFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    const [{ data: stackData }, { data: condData }, { data: medData }, { data: profile }] = await Promise.all([
      supabase
        .from("peptide_stacks")
        .select(
          "id, name, phase, is_active, peptide_stack_items ( id, dose_value, dose_unit, route, frequency, compounds ( slug, name, absolute_contraindications, relative_contraindications ) )",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("conditions").select("name").eq("active", true),
      supabase.from("medications").select("name").eq("active", true),
      supabase.from("profiles").select("dob, sex").eq("user_id", uid).maybeSingle(),
    ]);

    const activeStacks = (stackData ?? []) as unknown as Stack[];
    setStacks(activeStacks);

    const snapshot: UserHealthSnapshot = {
      conditions: (condData ?? []).map((c: { name: string }) => c.name),
      medications: (medData ?? []).map((m: { name: string }) => m.name),
      age: ageFromDob(profile?.dob ?? null),
      sex: profile?.sex ?? null,
    };
    const all: ContraindicationFinding[] = [];
    const seen = new Set<string>();
    for (const s of activeStacks) {
      for (const it of s.peptide_stack_items) {
        if (!it.compounds) continue;
        for (const f of evaluateContraindications(it.compounds, snapshot)) {
          const key = `${f.compoundSlug}:${f.severity}:${f.reason}`;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(f);
          }
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

  if (loading) return <Loading />;

  return (
    <Content className="gap-4">
      <ContraindicationBanner findings={findings} />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Active stacks</Text>
        {stacks.length === 0 ? (
          <EmptyState title="No active stack" hint="Create a stack from your clinician-approved compounds." />
        ) : (
          stacks.map((s) => (
            <Card key={s.id} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{s.name}</Text>
                {s.phase ? <Pill label={`Phase ${s.phase}`} tone="primary" /> : null}
              </View>
              {s.peptide_stack_items.map((it) => (
                <View key={it.id} className="flex-row items-center justify-between border-t border-border pt-2">
                  <Text className="flex-1 text-sm text-foreground">{it.compounds?.name ?? "—"}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {it.dose_value} {it.dose_unit} · {it.route} · {it.frequency}
                  </Text>
                </View>
              ))}
            </Card>
          ))
        )}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Tools</Text>
        <ListRow title="Compound Catalog" subtitle="All compounds + safety data" icon="list-outline" onPress={() => router.push("/(tabs)/peptides/compounds")} />
        <ListRow title="Protocol Library" subtitle="Evidence-graded dose references" icon="library-outline" onPress={() => router.push("/(tabs)/peptides/library")} />
        <ListRow title="Reconstitution" subtitle="Vial math + syringe draw" icon="flask-outline" onPress={() => router.push("/(tabs)/peptides/reconstitution")} />
        <ListRow title="Protocols" subtitle="Titration schedules + reference" icon="calendar-outline" onPress={() => router.push("/(tabs)/peptides/protocols")} />
        <ListRow title="Dose Log" subtitle="Record doses taken" icon="checkmark-done-outline" onPress={() => router.push("/(tabs)/peptides/dose-log")} />
        <ListRow title="New Stack" subtitle="Build a stack" icon="add-outline" onPress={() => router.push("/(tabs)/peptides/stacks-new")} />
      </View>
    </Content>
  );
}
