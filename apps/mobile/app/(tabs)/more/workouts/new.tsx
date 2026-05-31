import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Loading } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

interface TemplateExercise {
  name: string;
  sets?: number;
  reps?: number;
  duration_min?: number;
  notes?: string;
}
interface Template {
  slug: string;
  name: string;
  phase: string;
  session_type: string;
  description: string;
  exercises: TemplateExercise[];
}
interface DraftExercise {
  name: string;
  sets: string;
  reps: string;
  load_lb: string;
  duration_min: string;
  notes: string;
}

const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "lifting", label: "Lift" },
  { value: "mobility", label: "Mobility" },
  { value: "cardio", label: "Cardio" },
  { value: "walking", label: "Walk" },
  { value: "mixed", label: "Mixed" },
];
const PHASES: { value: string; label: string }[] = [
  { value: "P1", label: "P1" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
];

function emptyExercise(): DraftExercise {
  return { name: "", sets: "", reps: "", load_lb: "", duration_min: "", notes: "" };
}
function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

export default function NewWorkout() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const { template: slug } = useLocalSearchParams<{ template?: string }>();

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<Template | null>(null);
  const [sessionType, setSessionType] = useState("mixed");
  const [phase, setPhase] = useState("P1");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("30");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    Promise.all([
      supabase
        .from("goals")
        .select("phase")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      slug
        ? supabase
            .from("workout_templates")
            .select("slug,name,phase,session_type,description,exercises")
            .eq("slug", slug)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([goalRes, tplRes]) => {
      if (!mounted) return;
      const userPhase = (goalRes.data?.phase as string | null) ?? "P1";
      const tpl = (tplRes.data ?? null) as unknown as Template | null;
      setTemplate(tpl);
      setSessionType(tpl?.session_type ?? "mixed");
      setPhase(tpl?.phase ?? userPhase);
      setName(tpl?.name ?? "");
      setExercises(
        (tpl?.exercises ?? []).map((e) => ({
          name: e.name,
          sets: e.sets != null ? String(e.sets) : "",
          reps: e.reps != null ? String(e.reps) : "",
          load_lb: "",
          duration_min: e.duration_min != null ? String(e.duration_min) : "",
          notes: e.notes ?? "",
        })),
      );
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [uid, slug]);

  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }
  function updateExercise(idx: number, patch: Partial<DraftExercise>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!uid) return;
    if (!name.trim() && !template) {
      return Alert.alert("Name required", "Give the session a name.");
    }
    const named = exercises.filter((e) => e.name.trim());
    if (named.length === 0) {
      return Alert.alert("Add an exercise", "Add at least one exercise (with a name).");
    }
    setSaving(true);
    try {
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: uid,
          session_type: sessionType,
          phase,
          date,
          duration_min: numOrNull(duration),
          perceived_exertion: numOrNull(rpe),
          template_slug: template?.slug ?? null,
          name: name.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (wErr) throw wErr;

      const rows = named.map((e, idx) => ({
        workout_id: workout.id,
        user_id: uid,
        order_index: idx,
        name: e.name.trim(),
        sets: numOrNull(e.sets),
        reps: numOrNull(e.reps),
        load_lb: numOrNull(e.load_lb),
        duration_min: numOrNull(e.duration_min),
        notes: e.notes.trim() || null,
      }));
      const { error: eErr } = await supabase.from("workout_exercises").insert(rows);
      if (eErr) throw eErr;

      Alert.alert("Workout logged", `${name.trim() || "Session"} saved.`);
      router.back();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Content className="gap-4">
      <Card className="gap-4">
        <Field label="Session name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tuesday walk + bands"
          />
        </Field>
        <Field label="Type">
          <Segmented options={SESSION_TYPES} value={sessionType} onChange={setSessionType} />
        </Field>
        <Field label="Phase">
          <Segmented options={PHASES} value={phase} onChange={setPhase} />
        </Field>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Date">
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Duration (min)">
              <Input value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="30" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="RPE (1–10)">
              <Input value={rpe} onChangeText={setRpe} keyboardType="number-pad" placeholder="5" />
            </Field>
          </View>
        </View>
        <Field label="Notes (optional)">
          <Input value={notes} onChangeText={setNotes} placeholder="anything notable" />
        </Field>
      </Card>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Exercises
        </Text>
        <Button title="+ Add" variant="outline" onPress={addExercise} />
      </View>

      {exercises.length === 0 ? (
        <Text className="rounded-lg border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
          No exercises yet. Add one above.
        </Text>
      ) : (
        exercises.map((e, idx) => (
          <Card key={idx} className="gap-3">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input
                  value={e.name}
                  onChangeText={(v) => updateExercise(idx, { name: v })}
                  placeholder="Exercise name"
                />
              </View>
              <Pressable onPress={() => removeExercise(idx)}>
                <Text className="text-sm text-destructive">Remove</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Field label="Sets">
                  <Input value={e.sets} onChangeText={(v) => updateExercise(idx, { sets: v })} keyboardType="number-pad" placeholder="–" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Reps">
                  <Input value={e.reps} onChangeText={(v) => updateExercise(idx, { reps: v })} keyboardType="number-pad" placeholder="–" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Load lb">
                  <Input value={e.load_lb} onChangeText={(v) => updateExercise(idx, { load_lb: v })} keyboardType="decimal-pad" placeholder="–" />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Min">
                  <Input value={e.duration_min} onChangeText={(v) => updateExercise(idx, { duration_min: v })} keyboardType="number-pad" placeholder="–" />
                </Field>
              </View>
            </View>
            {e.notes ? (
              <Text className="text-xs italic text-muted-foreground">{e.notes}</Text>
            ) : null}
          </Card>
        ))
      )}

      <View className="flex-row gap-3">
        <Button title="Cancel" variant="outline" className="flex-1" onPress={() => router.back()} />
        <Button title="Save session" className="flex-1" onPress={save} loading={saving} />
      </View>
    </Content>
  );
}
