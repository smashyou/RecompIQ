import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import type { EvidenceLevel } from "@peptide/shared";
import { buildProjection } from "@peptide/projections";
import { Card } from "@/components/ui/Card";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Loading } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { loadSpendSnapshot } from "@/lib/inventory";
import { loadGoalCards, type GoalCardData } from "@/lib/goal-cards";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

interface ProtocolItem {
  slug: string;
  name: string;
  category: string;
  evidence_level: EvidenceLevel;
}
interface Snap {
  name: string;
  isDemo: boolean;
  goal: any;
  weights: { logged_at: string; value_lb: number }[];
  latestWeight: number | null;
  latestWeightAt: string | null;
  weekDelta: number | null;
  vital: any;
  symptom: any;
  steps: number | null;
  sleepMin: number | null;
  macros: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  recentDoses: { taken_at: string; adherence: string }[];
  activePhase: string | null;
  protocol: ProtocolItem[];
  spend: { last30Usd: number; allTimeUsd: number };
  goalCards: GoalCardData[];
  bodyShot: { lastCapturedAt: string | null; frequencyDays: number; overdue: boolean } | null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadDashboard(uid: string, email: string): Promise<Snap> {
  const today = todayStr();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const [profile, goalRes, weightsRes, vitalRes, sympRes, stepsRes, sleepRes, foodRes, stacksRes, dosesRes, settingsRes, bodyRes] =
    await Promise.all([
      supabase.from("profiles").select("display_name, is_demo").eq("user_id", uid).maybeSingle(),
      supabase.from("goals").select("start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks,phase,protein_target_g_min,protein_target_g_max").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("weights").select("logged_at,value_lb").eq("user_id", uid).order("logged_at", { ascending: true }).limit(60),
      supabase.from("vitals").select("bp_systolic,bp_diastolic,hr,glucose_mgdl,logged_at").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("symptoms").select("mood,energy,pain,nausea,logged_at").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("steps_logs").select("count").eq("user_id", uid).eq("day", today).maybeSingle(),
      supabase.from("sleep_logs").select("duration_min").eq("user_id", uid).eq("night_of", today).maybeSingle(),
      supabase.from("food_logs").select("calories_kcal,protein_g,carbs_g,fat_g").eq("user_id", uid).gte("logged_at", today),
      supabase
        .from("regimens")
        .select(
          "regimen_phases ( ordinal, name, legacy_phase, ends_on, regimen_items ( ends_on, compounds ( slug, name, category, evidence_level ) ) )",
        )
        .eq("user_id", uid)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("peptide_doses").select("taken_at,adherence").eq("user_id", uid).gte("taken_at", since).order("taken_at", { ascending: false }),
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
  const latestWeight = weights.length ? weights[weights.length - 1].value_lb : null;
  const latestWeightAt = weights.length ? weights[weights.length - 1].logged_at : null;

  // 7-day delta: latest vs the earliest weight within the trailing 7 days.
  let weekDelta: number | null = null;
  if (weights.length >= 2 && latestWeight != null) {
    const cutoff = Date.now() - 7 * 86400000;
    const prior = weights.filter((w) => new Date(w.logged_at).getTime() <= cutoff);
    const ref = prior.length ? prior[prior.length - 1] : weights[0];
    weekDelta = latestWeight - ref.value_lb;
  }

  // Regimen: current = items in still-open phases that haven't ended.
  const reg = stacksRes.data as any;
  const openPhases = ((reg?.regimen_phases ?? []) as any[])
    .filter((p) => p.ends_on === null)
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  const currentPhase = openPhases.length ? openPhases[openPhases.length - 1] : null;
  const protocol: ProtocolItem[] = openPhases
    .flatMap((p) => (p.regimen_items ?? []) as any[])
    .filter((i) => i.ends_on === null)
    .map((i) => (Array.isArray(i.compounds) ? i.compounds[0] : i.compounds))
    .filter(Boolean)
    .map((c: any) => ({ slug: c.slug, name: c.name, category: c.category, evidence_level: c.evidence_level }));

  const freqDays = (settingsRes.data as any)?.body_photo_frequency_days ?? 7;
  const lastCap = (bodyRes.data as any)?.captured_at ?? null;
  const overdue = !lastCap || Date.now() - new Date(lastCap).getTime() > freqDays * 86400000;

  const spend = await loadSpendSnapshot(uid);
  const goalCards = await loadGoalCards(uid);

  return {
    name: (profile.data as any)?.display_name ?? email ?? "there",
    isDemo: Boolean((profile.data as any)?.is_demo),
    goal,
    weights,
    latestWeight,
    latestWeightAt,
    weekDelta,
    vital: vitalRes.data,
    symptom: sympRes.data,
    steps: (stepsRes.data as any)?.count ?? null,
    sleepMin: (sleepRes.data as any)?.duration_min ?? null,
    macros,
    recentDoses: (dosesRes.data ?? []) as any[],
    activePhase: currentPhase?.legacy_phase ?? currentPhase?.name ?? null,
    protocol,
    spend,
    goalCards,
    bodyShot: { lastCapturedAt: lastCap, frequencyDays: freqDays, overdue },
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { session } = useSession();
  const { colors } = useTheme();
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

  const start = snap.goal ? Number(snap.goal.start_weight_lb) : null;
  const targetMid = snap.goal ? (Number(snap.goal.goal_weight_lb_min) + Number(snap.goal.goal_weight_lb_max)) / 2 : null;
  const lost = start != null && snap.latestWeight != null ? start - snap.latestWeight : null;
  const toTarget = targetMid != null && snap.latestWeight != null ? snap.latestWeight - targetMid : null;
  const proteinMax = snap.goal?.protein_target_g_max ?? null;
  const proteinPct = proteinMax ? Math.min(100, Math.round((snap.macros.protein_g / proteinMax) * 100)) : 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={colors.mutedForeground} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Overline color={colors.primary}>{snap.isDemo ? "Demo profile" : "Dashboard"}</Overline>
            <Text style={{ fontSize: 24, fontWeight: "600", letterSpacing: -0.5, color: colors.foreground, marginTop: 3 }} numberOfLines={1}>
              Welcome back
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ThemeToggle compact />
            <Avatar name={snap.name} colors={colors} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {/* Body-shot reminder (real alert) */}
          {snap.bodyShot?.overdue ? (
            <Pressable
              onPress={() => router.push("/(tabs)/more/body-shots/capture")}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warnLine, backgroundColor: colors.warnWash }}
            >
              <Ionicons name="camera-outline" size={16} color={colors.warn} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.foreground }}>
                <Text style={{ color: colors.warn, fontWeight: "600" }}>Body shots due</Text>
                {snap.bodyShot.lastCapturedAt
                  ? ` · last ~${Math.floor((Date.now() - new Date(snap.bodyShot.lastCapturedAt).getTime()) / 86400000)}d ago`
                  : " · first set"}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.fgSubtle} />
            </Pressable>
          ) : null}

          {/* Weight */}
          <Pressable onPress={() => router.push("/(tabs)/log")}>
            <MCard title="Weight" hint={snap.latestWeightAt ? fmtDate(snap.latestWeightAt) : undefined} colors={colors}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "500", fontSize: 32, letterSpacing: -0.6, color: colors.foreground }}>
                  {snap.latestWeight ?? "—"}
                  <Text style={{ fontSize: 14, color: colors.fgSubtle }}> lb</Text>
                </Text>
                {snap.weekDelta != null ? (
                  <Text style={{ fontVariant: ["tabular-nums"], fontSize: 12, color: snap.weekDelta <= 0 ? colors.positive : colors.warn }}>
                    7d {snap.weekDelta <= 0 ? "−" : "+"}{Math.abs(snap.weekDelta).toFixed(1)}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
                <StatCell label="Start" value={start != null ? start.toFixed(1) : "—"} colors={colors} />
                <StatCell label="Lost" value={lost != null ? Math.abs(lost).toFixed(1) : "—"} colors={colors} />
                <StatCell label="To target" value={toTarget != null ? Math.abs(toTarget).toFixed(1) : "—"} colors={colors} />
              </View>
              <Spark points={snap.weights.map((w) => w.value_lb)} color={colors.primary} />
            </MCard>
          </Pressable>

          {/* Projection */}
          {proj ? (
            <Pressable onPress={() => router.push("/(tabs)/more/projections")}>
              <MCard title="Projection" hint={proj.series.target.etaWeeks != null ? `ETA ${proj.series.target.etaWeeks} wk` : undefined} colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "500", fontSize: 26, color: colors.foreground }}>
                    {proj.series.target.lbsPerWeek.toFixed(2)}
                    <Text style={{ fontSize: 13, color: colors.fgSubtle }}> lb/wk</Text>
                  </Text>
                  <AdherencePill adherence={proj.adherence} colors={colors} />
                </View>
              </MCard>
            </Pressable>
          ) : null}

          {/* Vitals + Macros row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/log")}>
              <MCard title="Vitals" hint="Latest" colors={colors}>
                <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "500", fontSize: 24, color: colors.foreground }}>
                  {snap.vital?.bp_systolic != null && snap.vital?.bp_diastolic != null ? `${snap.vital.bp_systolic}/${snap.vital.bp_diastolic}` : "—"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.fgSubtle, marginTop: 4 }}>
                  {snap.vital?.glucose_mgdl != null ? `Glu ${snap.vital.glucose_mgdl}` : "BP"}
                  {snap.vital?.hr != null ? ` · ${snap.vital.hr} bpm` : ""}
                </Text>
              </MCard>
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/more/food")}>
              <MCard title="Protein" hint="Today" colors={colors}>
                <Ring pct={proteinPct} colors={colors} />
                <Text style={{ textAlign: "center", fontVariant: ["tabular-nums"], fontSize: 12, color: colors.mutedForeground, marginTop: 10 }}>
                  {Math.round(snap.macros.protein_g)}{proteinMax ? ` / ${proteinMax}g` : "g"}
                </Text>
              </MCard>
            </Pressable>
          </View>

          {/* Activity + Adherence row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/log")}>
              <MCard title="Activity" hint="Today" colors={colors}>
                <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "500", fontSize: 24, color: colors.foreground }}>
                  {snap.steps ?? "—"}
                  <Text style={{ fontSize: 12, color: colors.fgSubtle }}> steps</Text>
                </Text>
                <Text style={{ fontSize: 11, color: colors.fgSubtle, marginTop: 4 }}>
                  {snap.sleepMin != null ? `Sleep ${(snap.sleepMin / 60).toFixed(1)} h` : "No sleep logged"}
                </Text>
              </MCard>
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/peptides/dose-log")}>
              <MCard title="Adherence" hint="14d" colors={colors}>
                <AdherenceGrid doses={snap.recentDoses} colors={colors} />
              </MCard>
            </Pressable>
          </View>

          {/* Coach insight */}
          <Pressable onPress={() => router.push("/(tabs)/coach")}>
            <MCard colors={colors}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <GradientGlyph colors={colors} icon="pulse" />
                <View style={{ flex: 1 }}>
                  <Overline color={colors.primary} size={9.5}>Coach insight</Overline>
                  <Text style={{ fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground, marginTop: 4 }}>
                    {coachInsight(snap)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.fgSubtle} />
              </View>
            </MCard>
          </Pressable>

          {/* Active protocol */}
          {snap.protocol.length > 0 ? (
            <MCard title="Active protocol" hint={snap.activePhase ? `Phase ${snap.activePhase}` : undefined} colors={colors}>
              {snap.protocol.map((c, i) => (
                <Pressable
                  key={c.slug}
                  onPress={() => router.push({ pathname: "/(tabs)/peptides/library/[slug]", params: { slug: c.slug } })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="medical-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "600", fontSize: 13.5, color: colors.foreground }} numberOfLines={1}>{c.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.fgSubtle }} numberOfLines={1}>{c.category.replace(/_/g, " ")}</Text>
                  </View>
                  <EvidenceBadge level={c.evidence_level} />
                </Pressable>
              ))}
              <View style={{ marginTop: 12 }}>
                <SafetyDisclaimer variant="compact" />
              </View>
            </MCard>
          ) : null}

          {/* Spend snapshot */}
          {snap.spend.allTimeUsd > 0 ? (
            <Pressable onPress={() => router.push("/(tabs)/peptides/inventory")}>
              <MCard colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 13.5, color: colors.foreground }}>
                      ${Math.round(snap.spend.last30Usd).toLocaleString()} spent · last 30 days
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.fgSubtle }}>
                      ${Math.round(snap.spend.allTimeUsd).toLocaleString()} all-time · tap for inventory
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.fgSubtle} />
                </View>
              </MCard>
            </Pressable>
          ) : null}

          {/* Per-goal progress */}
          {snap.goalCards.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: "600", fontSize: 15, color: colors.foreground, marginTop: 4 }}>Goal progress</Text>
              {snap.goalCards.map((c) => {
                const improving =
                  c.observedPerWeek === null || c.observedPerWeek === 0
                    ? null
                    : c.higherIsBetter
                      ? c.observedPerWeek > 0
                      : c.observedPerWeek < 0;
                return (
                  <MCard key={c.goalKey} colors={colors}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: colors.fgSubtle, letterSpacing: 0.5 }}>
                          {c.goalLabel.toUpperCase()}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.fgSubtle, marginTop: 2 }}>{c.metricLabel}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 19, fontWeight: "700", color: colors.foreground }}>
                          {c.current ?? "—"}
                          <Text style={{ fontSize: 11, color: colors.fgSubtle }}> {c.unit}</Text>
                        </Text>
                        {improving !== null ? (
                          <Text style={{ fontSize: 11, color: improving ? colors.primary : colors.warn }}>
                            {c.observedPerWeek! > 0 ? "▲" : "▼"} {Math.abs(c.observedPerWeek!)}
                            {c.unit.startsWith("/") ? "" : ` ${c.unit}`}/wk
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 11, color: colors.fgSubtle }}>— flat</Text>
                        )}
                      </View>
                    </View>
                    {c.projection ? (
                      <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 3 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <Text style={{ fontSize: 11.5, color: colors.fgSubtle, flex: 1 }}>
                            Illustrative: ~{c.projection.targetValue}
                            {c.unit} by ~{c.projection.weeks} wks
                          </Text>
                          <EvidenceBadge level={c.projection.evidenceLevel as any} />
                        </View>
                        <Text style={{ fontSize: 10, color: colors.fgSubtle }}>
                          Not a predicted outcome. {c.projection.caveat} Discuss with your clinician.
                        </Text>
                      </View>
                    ) : null}
                  </MCard>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---- mobile primitives (match the handoff MCard/MHeader/Spark) ---- */

type Tokens = ReturnType<typeof useTheme>["colors"];

function MCard({ title, hint, children, colors }: { title?: string; hint?: string; children: React.ReactNode; colors: Tokens }) {
  return (
    <Card>
      {title || hint ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          {title ? <Text style={{ fontWeight: "600", fontSize: 13.5, color: colors.foreground }}>{title}</Text> : <View />}
          {hint ? <Text style={{ fontWeight: "600", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: colors.fgSubtle }}>{hint}</Text> : null}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

function Overline({ children, color, size = 10 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color }}>
      {children}
    </Text>
  );
}

function Avatar({ name, colors }: { name: string; colors: Tokens }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
  return (
    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontWeight: "600", fontSize: 14, color: colors.primaryForeground }}>{initials}</Text>
    </View>
  );
}

function GradientGlyph({ colors, icon }: { colors: Tokens; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={16} color={colors.primaryForeground} />
    </View>
  );
}

function StatCell({ label, value, colors }: { label: string; value: string; colors: Tokens }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: colors.fgSubtle }}>{label}</Text>
      <Text style={{ fontVariant: ["tabular-nums"], fontSize: 13, color: colors.foreground, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Ring({ pct, colors }: { pct: number; colors: Tokens }) {
  // SVG donut — RN can't do conic-gradient. Stroke-dashoffset arc.
  const size = 70, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface3} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.positive}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, pct / 100))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ position: "absolute", top: 0, bottom: 0, textAlignVertical: "center", fontVariant: ["tabular-nums"], fontSize: 14, color: colors.foreground }}>
        {pct}%
      </Text>
    </View>
  );
}

function Spark({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 320, h = 46;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map((v) => h - ((v - min) / span) * (h - 6) - 3);
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity={0.08} />
      <Path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AdherenceGrid({ doses, colors }: { doses: { taken_at: string; adherence: string }[]; colors: Tokens }) {
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
  const pct = Math.round((taken / 14) * 100);
  return (
    <>
      <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "500", fontSize: 24, color: colors.foreground }}>{pct}%</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 10 }}>
        {cells.map((c, i) => (
          <View
            key={i}
            style={{ width: "12.2%", height: 13, borderRadius: 3, backgroundColor: c === "taken" ? colors.positive : c === "partial" ? colors.positiveDim : colors.surface3 }}
          />
        ))}
      </View>
    </>
  );
}

function AdherencePill({ adherence, colors }: { adherence: string; colors: Tokens }) {
  const label = { ahead: "Ahead", "on-target": "On target", behind: "Behind", stalled: "Stalled", "insufficient-data": "Need data" }[adherence] ?? adherence;
  const good = adherence === "ahead" || adherence === "on-target";
  const bad = adherence === "behind" || adherence === "stalled";
  const c = good ? colors.positive : bad ? colors.danger : colors.fgSubtle;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c }}>
      <Text style={{ fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.7, color: c }}>{label}</Text>
    </View>
  );
}

function coachInsight(snap: Snap): string {
  const parts: string[] = [];
  if (snap.weekDelta != null) {
    const dir = snap.weekDelta <= 0 ? "Down" : "Up";
    parts.push(`${dir} ${Math.abs(snap.weekDelta).toFixed(1)} lb over 7 days.`);
  }
  if (snap.goal?.protein_target_g_min != null && snap.macros.protein_g < Number(snap.goal.protein_target_g_min)) {
    parts.push("Protein running under target today.");
  }
  if (parts.length === 0) parts.push("Log weight, vitals, and meals to unlock trend insights.");
  return parts.join(" ");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
