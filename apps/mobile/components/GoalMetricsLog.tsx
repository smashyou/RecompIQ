import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { metricsForGoals, METRIC_BY_KEY, type GoalKey, type MetricDef } from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { CognitionTest } from "@/components/CognitionTest";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";

export function GoalMetricsLog() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const [goalKeys, setGoalKeys] = useState<GoalKey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNeuro, setShowNeuro] = useState(false);
  const [showNausea, setShowNausea] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [circ, setCirc] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cognitionOpen, setCognitionOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("user_goals")
      .select("goal_key")
      .eq("user_id", uid)
      .then(({ data }) => {
        setGoalKeys((data ?? []).map((g: any) => g.goal_key));
        setLoaded(true);
      });
  }, [uid]);

  // Self-check gating: neuro_severity when the user has a nerve injury/condition,
  // nausea_severity when on any active compound. These 0–10 self-checks feed the
  // safety-alert engine — never doses, never free-text.
  useEffect(() => {
    if (!uid) return;
    const NEURO = /neuro|foot|numb|nerve|drop/i;
    Promise.all([
      supabase.from("injuries").select("name").eq("user_id", uid).eq("active", true),
      supabase.from("conditions").select("name").eq("user_id", uid).eq("active", true),
      supabase
        .from("regimen_items")
        .select("id, regimens!inner(is_active)")
        .eq("user_id", uid)
        .is("ends_on", null)
        .eq("regimens.is_active", true)
        .limit(1),
    ]).then(([inj, cond, items]) => {
      const names = [
        ...((inj.data ?? []) as any[]).map((r) => String(r.name ?? "")),
        ...((cond.data ?? []) as any[]).map((r) => String(r.name ?? "")),
      ];
      setShowNeuro(names.some((n) => NEURO.test(n)));
      setShowNausea(((items.data ?? []) as any[]).length > 0);
    });
  }, [uid]);

  const metrics = useMemo<MetricDef[]>(() => {
    const base = metricsForGoals(goalKeys).filter((m) => m.kind !== "objective");
    const have = new Set(base.map((m) => m.key));
    const extra: MetricDef[] = [];
    if (showNeuro && !have.has("neuro_severity") && METRIC_BY_KEY.neuro_severity)
      extra.push(METRIC_BY_KEY.neuro_severity);
    if (showNausea && !have.has("nausea_severity") && METRIC_BY_KEY.nausea_severity)
      extra.push(METRIC_BY_KEY.nausea_severity);
    return [...base, ...extra];
  }, [goalKeys, showNeuro, showNausea]);

  // Nearest anchor label for the current value (helper text under self-checks).
  function anchorFor(m: MetricDef, value: number): string | null {
    if (!m.anchors || m.anchors.length === 0) return null;
    let best = m.anchors[0];
    for (const a of m.anchors) {
      if (Math.abs(a.value - value) < Math.abs(best.value - value)) best = a;
    }
    return best.label;
  }

  function rate(m: MetricDef, delta: number) {
    setRatings((prev) => {
      const cur = prev[m.key] ?? Math.round((m.min + m.max) / 2);
      return { ...prev, [m.key]: Math.max(m.min, Math.min(m.max, cur + delta)) };
    });
  }

  async function save() {
    if (!uid) return;
    const rows: { user_id: string; metric_key: string; value: number; unit: string }[] = [];
    for (const m of metrics) {
      if (m.kind === "rating" && ratings[m.key] !== undefined) {
        rows.push({ user_id: uid, metric_key: m.key, value: ratings[m.key], unit: m.unit });
      } else if (m.kind === "circumference" && circ[m.key]) {
        const v = Number(circ[m.key]);
        if (v >= m.min && v <= m.max) rows.push({ user_id: uid, metric_key: m.key, value: v, unit: m.unit });
      }
    }
    if (rows.length === 0) return Alert.alert("Nothing to log", "Set at least one value.");
    setSaving(true);
    const { error } = await supabase.from("goal_metrics").insert(rows);
    setSaving(false);
    if (error) return Alert.alert("Could not save", error.message);
    Alert.alert("Logged", `${rows.length} metric(s) saved.`);
    setRatings({});
    setCirc({});
  }

  if (!loaded) return <Text style={{ color: colors.fgSubtle }}>Loading…</Text>;

  if (metrics.length === 0) {
    return (
      <Card className="gap-2">
        <Text style={{ color: colors.foreground, fontSize: 13 }}>No goal metrics yet.</Text>
        <Pressable onPress={() => router.push("/(tabs)/more/goals")}>
          <Text style={{ color: colors.primary, fontSize: 13 }}>Pick your goals →</Text>
        </Pressable>
      </Card>
    );
  }

  const showCognition = goalKeys.includes("cognition" as GoalKey);

  return (
    <View style={{ gap: 12 }}>
    <Card className="gap-4">
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Today's goal check-in</Text>
      {metrics.map((m) =>
        m.kind === "rating" ? (
          <View key={m.key} style={{ gap: 6 }}>
            <Text style={{ color: colors.fgSubtle, fontSize: 12 }}>
              {m.label}
              {m.hint ? `  ·  ${m.hint}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => rate(m, -1)} hitSlop={8}>
                <Ionicons name="remove-circle-outline" size={28} color={colors.fgSubtle} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", minWidth: 36, textAlign: "center" }}>
                {ratings[m.key] ?? Math.round((m.min + m.max) / 2)}
              </Text>
              <Pressable onPress={() => rate(m, 1)} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
              </Pressable>
              <Text style={{ color: colors.fgSubtle, fontSize: 11 }}>/ {m.max}</Text>
            </View>
            {m.anchors
              ? (() => {
                  const v = ratings[m.key] ?? Math.round((m.min + m.max) / 2);
                  const label = anchorFor(m, v);
                  return label ? (
                    <Text style={{ color: colors.fgFaint, fontSize: 11, fontStyle: "italic" }}>
                      {label}
                    </Text>
                  ) : null;
                })()
              : null}
          </View>
        ) : (
          <Field key={m.key} label={`${m.label} (${m.unit})`}>
            <Input
              value={circ[m.key] ?? ""}
              onChangeText={(v) => setCirc((prev) => ({ ...prev, [m.key]: v }))}
              keyboardType="decimal-pad"
              placeholder={m.unit}
            />
          </Field>
        ),
      )}
      <Button title="Log check-in" onPress={save} loading={saving} />
      <Text style={{ color: colors.fgSubtle, fontSize: 10.5 }}>Self-reported trends, not clinical measurements.</Text>
    </Card>

    {showCognition &&
      (cognitionOpen ? (
        <CognitionTest onClose={() => setCognitionOpen(false)} />
      ) : (
        <Button title="Take the 30-sec cognition check" variant="outline" onPress={() => setCognitionOpen(true)} />
      ))}
    </View>
  );
}
