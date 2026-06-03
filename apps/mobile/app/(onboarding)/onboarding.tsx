import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";
import { useTheme } from "@/lib/theme-context";
import { useResponsive } from "@/lib/responsive";

// Consent + 18 gate is enforced at the root layout (device-local ConsentGate)
// and recorded server-side at sign-up (educational_consent_at), so it is NOT an
// onboarding step here — only on web. This flow mirrors the remaining web steps,
// including the multi-goal selection step before "done".
const STEPS = ["welcome", "profile", "goal", "conditions", "medications", "injuries", "goals", "done"] as const;
type Step = (typeof STEPS)[number];

interface ListItem { name: string; detail: string }

export default function Onboarding() {
  const router = useRouter();
  const { type } = useResponsive();
  const [idx, setIdx] = useState(0);
  const step: Step = STEPS[idx];
  const [busy, setBusy] = useState(false);

  // profile
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [heightIn, setHeightIn] = useState("");
  // goal
  const [startW, setStartW] = useState("");
  const [goalMin, setGoalMin] = useState("");
  const [goalMax, setGoalMax] = useState("");
  const [weeks, setWeeks] = useState("26");
  const [proteinMin, setProteinMin] = useState("");
  const [proteinMax, setProteinMax] = useState("");
  // lists
  const [conditions, setConditions] = useState<ListItem[]>([]);
  const [medications, setMedications] = useState<ListItem[]>([]);
  const [injuries, setInjuries] = useState<ListItem[]>([]);
  // goals (multi-select taxonomy)
  const [goalKeys, setGoalKeys] = useState<string[]>([]);

  function onStartWeight(v: string) {
    setStartW(v);
    const sw = Number(v);
    if (sw > 0) {
      if (!proteinMin) setProteinMin(String(Math.round(sw * 0.6)));
      if (!proteinMax) setProteinMax(String(Math.round(sw * 0.8)));
    }
  }

  function toggleGoal(key: string) {
    setGoalKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function saveStep(): Promise<boolean> {
    try {
      if (step === "profile") {
        if (!displayName.trim()) { Alert.alert("Name required"); return false; }
        await apiFetch("/api/onboarding/profile", { method: "POST", body: JSON.stringify({ display_name: displayName.trim(), dob: dob || null, sex, height_in: heightIn ? Number(heightIn) : null, unit_weight: "lb", unit_length: "in" }) });
      } else if (step === "goal") {
        if (!(Number(startW) > 0)) { Alert.alert("Enter your start weight"); return false; }
        await apiFetch("/api/onboarding/goals", { method: "POST", body: JSON.stringify({ start_weight_lb: Number(startW), goal_weight_lb_min: Number(goalMin), goal_weight_lb_max: Number(goalMax), timeline_weeks: Number(weeks) || 26, phase: "P1", protein_target_g_min: Number(proteinMin), protein_target_g_max: Number(proteinMax) }) });
      } else if (step === "conditions") {
        await apiFetch("/api/onboarding/conditions", { method: "POST", body: JSON.stringify({ items: conditions.filter((c) => c.name.trim()).map((c) => ({ name: c.name, detail: c.detail || null })) }) });
      } else if (step === "medications") {
        await apiFetch("/api/onboarding/medications", { method: "POST", body: JSON.stringify({ items: medications.filter((m) => m.name.trim()).map((m) => ({ name: m.name, dose: m.detail || null })) }) });
      } else if (step === "injuries") {
        await apiFetch("/api/onboarding/injuries", { method: "POST", body: JSON.stringify({ items: injuries.filter((i) => i.name.trim()).map((i) => ({ name: i.name, detail: i.detail || null })) }) });
      } else if (step === "goals") {
        // Goals are OPTIONAL — proceed regardless of a transient save error.
        try {
          await apiFetch("/api/goals", { method: "PUT", body: JSON.stringify({ goals: goalKeys.map((goal_key, i) => ({ goal_key, priority: i + 1, status: "active" })) }) });
        } catch {
          // swallow — optional step
        }
      }
      return true;
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
      return false;
    }
  }

  async function next() {
    setBusy(true);
    const ok = await saveStep();
    setBusy(false);
    if (!ok) return;
    if (step === "done") return finish();
    setIdx((i) => Math.min(STEPS.length - 1, i + 1));
  }
  async function finish() {
    setBusy(true);
    try {
      await apiFetch("/api/onboarding/complete", { method: "POST", body: JSON.stringify({}) });
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Could not finish", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row gap-1 px-4 pt-3">
          {STEPS.map((s, i) => (
            <View key={s} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= idx ? colors.primary : colors.muted }} />
          ))}
        </View>

        <ScrollView contentContainerClassName="px-4 pb-6 pt-4" keyboardShouldPersistTaps="handled">
          <View className="gap-4" style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}>
          {step === "welcome" ? (
            <View className="gap-3">
              <Text className="font-bold text-foreground" style={{ fontSize: type["3xl"] }}>Welcome to RecompIQ</Text>
              <Text className="text-base text-muted-foreground">A few quick questions to personalize your tracking. This is educational tracking — not medical advice. Nothing here prescribes doses.</Text>
              <Pressable onPress={() => router.push("/legal")}>
                <Text className="text-sm text-primary">Review Terms, Privacy, Medical Disclaimer & Research-Use →</Text>
              </Pressable>
            </View>
          ) : step === "profile" ? (
            <Card className="gap-4">
              <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>About you</Text>
              <Field label="Display name"><Input value={displayName} onChangeText={setDisplayName} placeholder="Your name" /></Field>
              <Field label="Date of birth (YYYY-MM-DD)"><Input value={dob} onChangeText={setDob} placeholder="1984-06-15" /></Field>
              <Field label="Sex"><Segmented options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "intersex", label: "Intersex" }, { value: "prefer_not_to_say", label: "N/A" }]} value={sex} onChange={setSex} fill /></Field>
              <Field label="Height (inches)"><Input value={heightIn} onChangeText={setHeightIn} keyboardType="decimal-pad" placeholder="70.5" /></Field>
            </Card>
          ) : step === "goal" ? (
            <Card className="gap-4">
              <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>Your goal</Text>
              <Field label="Start weight (lb)"><Input value={startW} onChangeText={onStartWeight} keyboardType="decimal-pad" placeholder="265" /></Field>
              <View className="flex-row gap-3">
                <View className="flex-1"><Field label="Goal min (lb)"><Input value={goalMin} onChangeText={setGoalMin} keyboardType="decimal-pad" placeholder="190" /></Field></View>
                <View className="flex-1"><Field label="Goal max (lb)"><Input value={goalMax} onChangeText={setGoalMax} keyboardType="decimal-pad" placeholder="200" /></Field></View>
              </View>
              <Field label="Timeline (weeks)"><Input value={weeks} onChangeText={setWeeks} keyboardType="number-pad" /></Field>
              <View className="flex-row gap-3">
                <View className="flex-1"><Field label="Protein min (g)" hint="auto 0.6 g/lb"><Input value={proteinMin} onChangeText={setProteinMin} keyboardType="number-pad" /></Field></View>
                <View className="flex-1"><Field label="Protein max (g)" hint="auto 0.8 g/lb"><Input value={proteinMax} onChangeText={setProteinMax} keyboardType="number-pad" /></Field></View>
              </View>
            </Card>
          ) : step === "conditions" ? (
            <ListStep title="Conditions" hint="Any diagnosed conditions (optional)." items={conditions} setItems={setConditions} detailLabel="Detail" />
          ) : step === "medications" ? (
            <ListStep title="Medications" hint="Current medications (optional)." items={medications} setItems={setMedications} detailLabel="Dose" />
          ) : step === "injuries" ? (
            <ListStep title="Injuries" hint="Injury history that affects training (optional)." items={injuries} setItems={setInjuries} detailLabel="Detail" />
          ) : step === "goals" ? (
            <GoalsStep selected={goalKeys} toggle={toggleGoal} />
          ) : (
            <View className="gap-3">
              <Text className="font-bold text-foreground" style={{ fontSize: type["3xl"] }}>You're all set</Text>
              <Text className="text-base text-muted-foreground">Your profile is ready. Tap finish to head to your dashboard.</Text>
            </View>
          )}
          </View>
        </ScrollView>

        <View className="flex-row gap-3 border-t border-border p-4">
          {idx > 0 ? <Button title="Back" variant="outline" onPress={() => setIdx((i) => Math.max(0, i - 1))} className="flex-1" /> : null}
          <Button title={step === "done" ? "Finish" : "Continue"} onPress={next} loading={busy} className="flex-[2]" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Multi-goal selection — mirrors the web onboarding "goals" step and the mobile
// More → Goals screen. Optional; priority follows selection order.
function GoalsStep({ selected, toggle }: { selected: string[]; toggle: (key: string) => void }) {
  const { colors } = useTheme();
  const { type } = useResponsive();
  return (
    <Card className="gap-3">
      <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>What are your goals?</Text>
      <Text className="text-sm text-muted-foreground">
        Pick the outcomes you care about — they decide what we track and project, and guide the AI.
        Priority follows selection order. You can change these anytime. (Optional.)
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
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: colors.foreground }}>{g.label}</Text>
                <Text style={{ fontSize: 12, color: colors.fgSubtle, marginTop: 2 }}>{g.blurb}</Text>
              </View>
              <Ionicons
                name={on ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={on ? colors.primary : colors.border}
              />
            </View>
            {on && rank > 0 ? (
              <Text style={{ fontSize: 10.5, color: colors.fgSubtle }}>priority {rank}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

function ListStep({ title, hint, items, setItems, detailLabel }: { title: string; hint: string; items: ListItem[]; setItems: (f: ListItem[]) => void; detailLabel: string }) {
  const { type } = useResponsive();
  return (
    <Card className="gap-3">
      <Text className="font-semibold text-foreground" style={{ fontSize: type.xl }}>{title}</Text>
      <Text className="text-sm text-muted-foreground">{hint}</Text>
      {items.map((it, i) => (
        <View key={i} className="gap-2 rounded-lg border border-border p-3">
          <Input value={it.name} onChangeText={(v) => setItems(items.map((x, j) => (j === i ? { ...x, name: v } : x)))} placeholder="Name" />
          <Input value={it.detail} onChangeText={(v) => setItems(items.map((x, j) => (j === i ? { ...x, detail: v } : x)))} placeholder={detailLabel} />
          <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))}><Text className="text-sm text-destructive">Remove</Text></Pressable>
        </View>
      ))}
      <Button title={`Add ${title.toLowerCase().replace(/s$/, "")}`} variant="outline" onPress={() => setItems([...items, { name: "", detail: "" }])} />
    </Card>
  );
}
