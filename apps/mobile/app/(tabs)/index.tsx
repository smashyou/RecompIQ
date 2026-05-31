import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline } from "react-native-svg";
import { buildProjection } from "@peptide/projections";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Loading } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

interface Snap {
  name: string;
  isDemo: boolean;
  goal: any;
  weights: { logged_at: string; value_lb: number }[];
  latestWeight: number | null;
  vital: any;
  symptom: any;
  steps: number | null;
  sleepMin: number | null;
  macros: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  hasActiveStack: boolean;
  recentDoses: { taken_at: string; adherence: string }[];
  todayWorkout: { name: string | null; session_type: string; duration_min: number | null } | null;
  suggestion: { slug: string; name: string; phase: string } | null;
  bodyShot: { lastCapturedAt: string | null; frequencyDays: number; overdue: boolean } | null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadDashboard(uid: string, email: string): Promise<Snap> {
  const today = todayStr();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const [profile, goalRes, weightsRes, vitalRes, sympRes, stepsRes, sleepRes, foodRes, stacksRes, dosesRes, workoutRes, settingsRes, bodyRes] =
    await Promise.all([
      supabase.from("profiles").select("display_name, is_demo").eq("user_id", uid).maybeSingle(),
      supabase.from("goals").select("start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks,phase,protein_target_g_min,protein_target_g_max").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("weights").select("logged_at,value_lb").eq("user_id", uid).order("logged_at", { ascending: true }).limit(60),
      supabase.from("vitals").select("bp_systolic,bp_diastolic,hr,glucose_mgdl,logged_at").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("symptoms").select("mood,energy,pain,nausea,logged_at").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("steps_logs").select("count").eq("user_id", uid).eq("day", today).maybeSingle(),
      supabase.from("sleep_logs").select("duration_min").eq("user_id", uid).eq("night_of", today).maybeSingle(),
      supabase.from("food_logs").select("calories_kcal,protein_g,carbs_g,fat_g").eq("user_id", uid).gte("logged_at", today),
      supabase.from("peptide_stacks").select("id").eq("user_id", uid).eq("is_active", true).limit(1),
      supabase.from("peptide_doses").select("taken_at,adherence").eq("user_id", uid).gte("taken_at", since).order("taken_at", { ascending: false }),
      supabase.from("workouts").select("name,session_type,duration_min").eq("user_id", uid).eq("date", today).maybeSingle(),
      supabase.from("user_settings").select("body_photo_frequency_days").eq("user_id", uid).maybeSingle(),
      supabase.from("body_photos").select("captured_at").eq("user_id", uid).order("captured_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const weights = ((weightsRes.data ?? []) as any[]).map((w) => ({ logged_at: w.logged_at, value_lb: Number(w.value_lb) }));
  const foods = (foodRes.data ?? []) as any[];
  const macros = foods.reduce(
    (a, f) => ({
      calories_kcal: a.calories_kcal + Number(f.calories_kcal ?? 0),
      protein_g: a.protein_g + Number(f.protein_g ?? 0),
      carbs_g: a.carbs_g + Number(f.carbs_g ?? 0),
      fat_g: a.fat_g + Number(f.fat_g ?? 0),
    }),
    { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const goal = goalRes.data as any;
  let suggestion: Snap["suggestion"] = null;
  if (!workoutRes.data && goal?.phase) {
    const { data: tmpl } = await supabase.from("workout_templates").select("slug,name,phase").eq("phase", goal.phase).limit(1).maybeSingle();
    if (tmpl) suggestion = tmpl as any;
  }

  const freqDays = (settingsRes.data as any)?.body_photo_frequency_days ?? 7;
  const lastCap = (bodyRes.data as any)?.captured_at ?? null;
  const overdue = !lastCap || Date.now() - new Date(lastCap).getTime() > freqDays * 86400000;

  return {
    name: (profile.data as any)?.display_name ?? email ?? "there",
    isDemo: Boolean((profile.data as any)?.is_demo),
    goal,
    weights,
    latestWeight: weights.length ? weights[weights.length - 1].value_lb : null,
    vital: vitalRes.data,
    symptom: sympRes.data,
    steps: (stepsRes.data as any)?.count ?? null,
    sleepMin: (sleepRes.data as any)?.duration_min ?? null,
    macros,
    hasActiveStack: ((stacksRes.data ?? []) as any[]).length > 0,
    recentDoses: (dosesRes.data ?? []) as any[],
    todayWorkout: (workoutRes.data as any) ?? null,
    suggestion,
    bodyShot: { lastCapturedAt: lastCap, frequencyDays: freqDays, overdue },
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { session } = useSession();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setSnap(await loadDashboard(session.user.id, session.user.email ?? ""));
    } catch {
      /* ignore */
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh]),
  );

  if (loading) return <Loading />;
  if (!snap) return null;

  const proj = snap.goal
    ? buildProjection({
        weights: snap.weights,
        startWeightLb: Number(snap.goal.start_weight_lb),
        goalWeightLbMin: Number(snap.goal.goal_weight_lb_min),
        goalWeightLbMax: Number(snap.goal.goal_weight_lb_max),
        timelineWeeks: snap.goal.timeline_weeks,
      })
    : null;

  const lost = snap.goal && snap.latestWeight != null ? Number(snap.goal.start_weight_lb) - snap.latestWeight : null;
  const proteinPct = snap.goal?.protein_target_g_max ? Math.min(100, Math.round((snap.macros.protein_g / snap.goal.protein_target_g_max) * 100)) : 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-4 pb-12 pt-2 gap-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={colors.mutedForeground} />}
      >
        <View className="mb-1">
          <Text className="text-2xl font-bold text-foreground">Welcome back, {snap.name}</Text>
          <Text className="text-sm text-muted-foreground">
            {snap.isDemo ? "Viewing the demo profile — values are illustrative." : "Educational tracking. Not medical advice."}
          </Text>
        </View>

        {snap.bodyShot?.overdue ? (
          <Pressable onPress={() => router.push("/(tabs)/more/body-shots/capture")} className="flex-row items-center justify-between rounded-xl border border-primary bg-card p-4 active:opacity-80">
            <View className="flex-1 flex-row items-center gap-3">
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Time for new body shots</Text>
                <Text className="text-xs text-muted-foreground">
                  {snap.bodyShot.lastCapturedAt
                    ? `Last set ~${Math.floor((Date.now() - new Date(snap.bodyShot.lastCapturedAt).getTime()) / 86400000)} days ago · every ${snap.bodyShot.frequencyDays} days.`
                    : "You haven't taken your first set yet. 4 angles, even lighting."}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-primary">Capture →</Text>
          </Pressable>
        ) : null}

        {/* Weight */}
        <DashCard title="Weight" onPress={() => router.push("/(tabs)/log")}>
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-4xl font-bold text-foreground">{snap.latestWeight ?? "—"}<Text className="text-lg text-muted-foreground"> lb</Text></Text>
              <View className="mt-1 flex-row flex-wrap gap-x-3">
                {snap.goal ? <Text className="text-xs text-muted-foreground">Goal {snap.goal.goal_weight_lb_min}–{snap.goal.goal_weight_lb_max} lb</Text> : null}
                {lost != null ? <Text className="text-xs text-accent">{lost >= 0 ? "−" : "+"}{Math.abs(lost).toFixed(1)} lb from start</Text> : null}
              </View>
            </View>
            <Sparkline data={snap.weights.map((w) => w.value_lb)} />
          </View>
        </DashCard>

        {/* Projection */}
        {proj ? (
          <DashCard title="Projection" onPress={() => router.push("/(tabs)/more/projections")}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted-foreground">Target rate</Text>
                <Text className="text-2xl font-bold text-foreground">{proj.series.target.lbsPerWeek.toFixed(2)}<Text className="text-sm text-muted-foreground"> lb/wk</Text></Text>
                {proj.series.target.etaWeeks != null ? <Text className="text-xs text-muted-foreground">ETA {proj.series.target.etaWeeks} wk</Text> : null}
              </View>
              <Pill label={adherenceLabel(proj.adherence)} tone={adherenceTone(proj.adherence)} />
            </View>
          </DashCard>
        ) : null}

        {/* Vitals + Activity row */}
        <View className="flex-row gap-3">
          <DashCard title="Vitals" className="flex-1" onPress={() => router.push("/(tabs)/log")}>
            <Text className="text-2xl font-bold text-foreground">{snap.vital?.bp_systolic != null && snap.vital?.bp_diastolic != null ? `${snap.vital.bp_systolic}/${snap.vital.bp_diastolic}` : "—"}</Text>
            <Text className="text-xs text-muted-foreground">{snap.vital?.glucose_mgdl != null ? `Glucose ${snap.vital.glucose_mgdl} mg/dL` : "BP"}{snap.vital?.hr != null ? ` · ${snap.vital.hr} bpm` : ""}</Text>
          </DashCard>
          <DashCard title="Activity" className="flex-1" onPress={() => router.push("/(tabs)/log")}>
            <Text className="text-2xl font-bold text-foreground">{snap.steps ?? "—"}<Text className="text-sm text-muted-foreground"> steps</Text></Text>
            <Text className="text-xs text-muted-foreground">{snap.sleepMin != null ? `Sleep ${(snap.sleepMin / 60).toFixed(1)} h` : "No sleep logged"}</Text>
          </DashCard>
        </View>

        {/* Macros */}
        <DashCard title="Macros today" onPress={() => router.push("/(tabs)/more/food")}>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-3xl font-bold text-foreground">{Math.round(snap.macros.protein_g)}<Text className="text-base text-muted-foreground"> g protein</Text></Text>
            {snap.goal ? <Text className="text-xs text-muted-foreground">target {snap.goal.protein_target_g_min}–{snap.goal.protein_target_g_max} g</Text> : null}
          </View>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><View className="h-full rounded-full bg-primary" style={{ width: `${proteinPct}%` }} /></View>
          <Text className="mt-2 text-xs text-muted-foreground">{Math.round(snap.macros.calories_kcal)} kcal · {Math.round(snap.macros.carbs_g)}c · {Math.round(snap.macros.fat_g)}f</Text>
        </DashCard>

        {/* Symptoms */}
        {snap.symptom ? (
          <DashCard title="Symptoms" onPress={() => router.push("/(tabs)/log")}>
            <Text className="text-sm text-muted-foreground">Mood {snap.symptom.mood ?? "—"}/5 · Energy {snap.symptom.energy ?? "—"}/5 · Pain {snap.symptom.pain ?? "—"}/10{snap.symptom.nausea ? " · nausea" : ""}</Text>
          </DashCard>
        ) : null}

        {/* Adherence */}
        {snap.hasActiveStack ? (
          <DashCard title="Peptide adherence" onPress={() => router.push("/(tabs)/peptides/dose-log")}>
            <AdherenceGrid doses={snap.recentDoses} />
          </DashCard>
        ) : null}

        {/* Workout */}
        <DashCard title="Workout" onPress={() => router.push("/(tabs)/more/workouts")}>
          {snap.todayWorkout ? (
            <Text className="text-sm text-foreground">{snap.todayWorkout.name ?? snap.todayWorkout.session_type}{snap.todayWorkout.duration_min ? ` · ${snap.todayWorkout.duration_min} min` : ""}</Text>
          ) : snap.suggestion ? (
            <Text className="text-sm text-muted-foreground">Suggested: {snap.suggestion.name} ({snap.suggestion.phase})</Text>
          ) : (
            <Text className="text-sm text-muted-foreground">No session logged today.</Text>
          )}
        </DashCard>

        <Card className="gap-1">
          <Text className="text-sm font-semibold text-foreground">Safety alerts</Text>
          <Text className="text-xs text-muted-foreground">Coming soon.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashCard({ title, children, onPress, className }: { title: string; children: React.ReactNode; onPress?: () => void; className?: string }) {
  return (
    <Pressable onPress={onPress} className={className}>
      <Card className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">{title}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} /> : null}
        </View>
        {children}
      </Card>
    </Pressable>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 100, h = 36;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={1.5} />
    </Svg>
  );
}

function AdherenceGrid({ doses }: { doses: { taken_at: string; adherence: string }[] }) {
  // 14-day grid: taken=accent, partial=primary, else muted.
  const days: Record<string, string> = {};
  for (const d of doses) {
    const day = d.taken_at.slice(0, 10);
    if (!days[day] || d.adherence === "taken") days[day] = d.adherence;
  }
  const cells = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    return days[dt] ?? null;
  });
  const taken = cells.filter((c) => c === "taken").length;
  return (
    <>
      <View className="flex-row gap-1">
        {cells.map((c, i) => (
          <View key={i} className="h-5 flex-1 rounded" style={{ backgroundColor: c === "taken" ? colors.accent : c === "partial" ? colors.primary : colors.muted }} />
        ))}
      </View>
      <Text className="mt-2 text-xs text-muted-foreground">{taken}/14 days logged</Text>
    </>
  );
}

function adherenceLabel(a: string): string {
  return { ahead: "Ahead", "on-target": "On target", behind: "Behind", stalled: "Stalled", "insufficient-data": "Need data" }[a] ?? a;
}
function adherenceTone(a: string): "default" | "accent" | "destructive" {
  if (a === "ahead" || a === "on-target") return "accent";
  if (a === "behind" || a === "stalled") return "destructive";
  return "default";
}
