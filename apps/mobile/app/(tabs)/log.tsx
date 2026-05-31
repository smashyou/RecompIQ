import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { TileSelect, type TileOption } from "@/components/ui/TileSelect";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type Tab = "weight" | "vitals" | "symptoms" | "sleep" | "water" | "steps";

const TABS: ReadonlyArray<TileOption<Tab>> = [
  { value: "weight", label: "Weight", icon: "scale-outline" },
  { value: "vitals", label: "Vitals", icon: "heart-outline" },
  { value: "symptoms", label: "Symptoms", icon: "medkit-outline" },
  { value: "sleep", label: "Sleep", icon: "moon-outline" },
  { value: "water", label: "Water", icon: "water-outline" },
  { value: "steps", label: "Steps", icon: "walk-outline" },
];

const RATING_1_5 = ["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }));

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

export default function QuickLog() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [tab, setTab] = useState<Tab>("weight");
  const [saving, setSaving] = useState(false);

  // Field state (kept flat; each tab reads what it needs).
  const [weight, setWeight] = useState("");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [glucose, setGlucose] = useState("");
  const [mood, setMood] = useState("3");
  const [energy, setEnergy] = useState("3");
  const [pain, setPain] = useState("");
  const [nausea, setNausea] = useState(false);
  const [sleepMin, setSleepMin] = useState("");
  const [sleepQuality, setSleepQuality] = useState("3");
  const [water, setWater] = useState("");
  const [steps, setSteps] = useState("");

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      let res;
      if (tab === "weight") {
        const v = num(weight);
        if (v == null) throw new Error("Enter a weight in lb.");
        res = await supabase.from("weights").insert({ user_id: userId, value_lb: v });
      } else if (tab === "vitals") {
        const payload = {
          user_id: userId,
          bp_systolic: num(sys),
          bp_diastolic: num(dia),
          hr: num(hr),
          glucose_mgdl: num(glucose),
        };
        if (
          payload.bp_systolic == null &&
          payload.bp_diastolic == null &&
          payload.hr == null &&
          payload.glucose_mgdl == null
        ) {
          throw new Error("Enter at least one vital.");
        }
        res = await supabase.from("vitals").insert(payload);
      } else if (tab === "symptoms") {
        res = await supabase.from("symptoms").insert({
          user_id: userId,
          mood: num(mood),
          energy: num(energy),
          pain: num(pain),
          nausea,
        });
      } else if (tab === "sleep") {
        const mins = num(sleepMin);
        if (mins == null) throw new Error("Enter sleep duration in minutes.");
        res = await supabase.from("sleep_logs").upsert(
          {
            user_id: userId,
            night_of: todayDate(),
            duration_min: mins,
            quality: num(sleepQuality),
          },
          { onConflict: "user_id,night_of" },
        );
      } else if (tab === "water") {
        const v = num(water);
        if (v == null) throw new Error("Enter a volume in oz.");
        res = await supabase.from("water_logs").insert({ user_id: userId, volume_oz: v });
      } else {
        const v = num(steps);
        if (v == null) throw new Error("Enter a step count.");
        res = await supabase
          .from("steps_logs")
          .upsert(
            { user_id: userId, day: todayDate(), count: v },
            { onConflict: "user_id,day" },
          );
      }
      if (res.error) throw res.error;
      Alert.alert("Logged", "Saved to your timeline.");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen className="gap-4">
      <Text className="text-2xl font-bold text-foreground">Quick log</Text>
      <TileSelect options={TABS} value={tab} onChange={setTab} />

      <Card className="gap-4">
        {tab === "weight" && (
          <Field label="Weight (lb)">
            <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 248.5" />
          </Field>
        )}

        {tab === "vitals" && (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Systolic">
                  <Input value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="120" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Diastolic">
                  <Input value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="80" />
                </Field>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Heart rate">
                  <Input value={hr} onChangeText={setHr} keyboardType="number-pad" placeholder="bpm" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Glucose (mg/dL)">
                  <Input value={glucose} onChangeText={setGlucose} keyboardType="decimal-pad" placeholder="95" />
                </Field>
              </View>
            </View>
          </>
        )}

        {tab === "symptoms" && (
          <>
            <Field label="Mood (1–5)">
              <Segmented options={RATING_1_5} value={mood} onChange={setMood} />
            </Field>
            <Field label="Energy (1–5)">
              <Segmented options={RATING_1_5} value={energy} onChange={setEnergy} />
            </Field>
            <Field label="Pain (0–10)">
              <Input value={pain} onChangeText={setPain} keyboardType="number-pad" placeholder="0" />
            </Field>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-muted-foreground">Nausea</Text>
              <Button
                title={nausea ? "Yes" : "No"}
                variant={nausea ? "primary" : "outline"}
                onPress={() => setNausea((v) => !v)}
                className="px-6 py-2"
              />
            </View>
          </>
        )}

        {tab === "sleep" && (
          <>
            <Field label="Duration (minutes)">
              <Input value={sleepMin} onChangeText={setSleepMin} keyboardType="number-pad" placeholder="e.g. 420" />
            </Field>
            <Field label="Quality (1–5)">
              <Segmented options={RATING_1_5} value={sleepQuality} onChange={setSleepQuality} />
            </Field>
            <Text className="text-xs text-muted-foreground">Saved against last night ({todayDate()}).</Text>
          </>
        )}

        {tab === "water" && (
          <Field label="Volume (oz)">
            <Input value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder="e.g. 16" />
          </Field>
        )}

        {tab === "steps" && (
          <Field label="Steps today">
            <Input value={steps} onChangeText={setSteps} keyboardType="number-pad" placeholder="e.g. 6000" />
          </Field>
        )}
      </Card>

      <Button title="Save" onPress={save} loading={saving} />
    </Screen>
  );
}
