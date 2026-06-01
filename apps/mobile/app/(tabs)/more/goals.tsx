import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Content } from "@/components/ui/Content";
import { Loading } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";

const prettify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Goals() {
  const { session } = useSession();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const slugs = Array.from(new Set(GOAL_TAXONOMY.flatMap((g) => g.representativeSlugs)));
    const [{ data: goals }, { data: compounds }] = await Promise.all([
      supabase.from("user_goals").select("goal_key,priority").eq("user_id", uid).order("priority"),
      supabase.from("compounds").select("slug,name").in("slug", slugs),
    ]);
    setSelected((goals ?? []).map((g: any) => g.goal_key));
    const m: Record<string, string> = {};
    for (const c of (compounds ?? []) as any[]) m[c.slug] = c.name;
    setNames(m);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("user_goals").select("id,goal_key").eq("user_id", uid);
      const removed = (existing ?? []).filter((r: any) => !selected.includes(r.goal_key));
      if (removed.length) await supabase.from("user_goals").delete().in("id", removed.map((r: any) => r.id));
      if (selected.length)
        await supabase
          .from("user_goals")
          .upsert(
            selected.map((k, i) => ({ user_id: uid, goal_key: k, priority: i + 1, status: "active" })),
            { onConflict: "user_id,goal_key" },
          );
      Alert.alert("Saved", selected.length ? `${selected.length} goal(s) saved.` : "Goals cleared.");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Content className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Pick the outcomes you care about. Goals decide what we track and project, and guide the AI.
        Priority follows selection order. Compounds are an evidence-graded mapping, not advice.
      </Text>
      {GOAL_TAXONOMY.map((g) => {
        const on = selected.includes(g.key);
        const rank = selected.indexOf(g.key) + 1;
        return (
          <Pressable
            key={g.key}
            onPress={() => toggle(g.key)}
            style={{
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              borderColor: on ? colors.primary : colors.border,
              backgroundColor: on ? colors.surface2 : colors.card,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.foreground }}>{g.label}</Text>
                  {g.hasV1Projection ? (
                    <Text style={{ fontSize: 9, fontWeight: "700", color: colors.fgSubtle }}>PROJECTED</Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: colors.fgSubtle, marginTop: 2 }}>{g.blurb}</Text>
              </View>
              <Ionicons
                name={on ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={on ? colors.primary : colors.border}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {g.representativeSlugs.slice(0, 4).map((slug) => (
                <Text
                  key={slug}
                  style={{
                    fontSize: 10.5,
                    color: colors.fgSubtle,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  {names[slug] ?? prettify(slug)}
                </Text>
              ))}
            </View>
            <Text style={{ fontSize: 10.5, color: colors.fgSubtle }}>
              Tracks: {g.signals.join(" · ")}
              {on && rank > 0 ? `  ·  priority ${rank}` : ""}
            </Text>
          </Pressable>
        );
      })}
      <Button title={saving ? "Saving…" : `Save goals (${selected.length})`} onPress={save} loading={saving} />
    </Content>
  );
}
