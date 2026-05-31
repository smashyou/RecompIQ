import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import Svg, { Line, Polyline, Circle, Rect, Text as SvgText } from "react-native-svg";
import { buildProjection } from "@peptide/projections";
import type { ProjectionResult, WeightPoint } from "@peptide/projections";
import { Content } from "@/components/ui/Content";
import { Card } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { colors } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

interface GoalRow {
  start_weight_lb: number;
  goal_weight_lb_min: number;
  goal_weight_lb_max: number;
  timeline_weeks: number;
}

// Mirrors the web page's adherence copy + tone mapping. Web tones map to the
// mobile Pill: good → accent, warn → destructive, neutral → default.
const ADHERENCE: Record<
  ProjectionResult["adherence"],
  { label: string; tone: PillTone }
> = {
  ahead: { label: "Ahead of target", tone: "accent" },
  "on-target": { label: "On target", tone: "accent" },
  behind: { label: "Behind pace", tone: "destructive" },
  stalled: { label: "Stalled — review intake / sleep", tone: "destructive" },
  "insufficient-data": { label: "Need more weigh-ins", tone: "default" },
};

export default function Projections() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [goalRes, weightsRes] = await Promise.all([
      supabase
        .from("goals")
        .select("start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("weights")
        .select("logged_at,value_lb")
        .eq("user_id", uid)
        .order("logged_at", { ascending: true }),
    ]);

    if (goalRes.error) setError(goalRes.error.message);
    else if (weightsRes.error) setError(weightsRes.error.message);
    else {
      setError(null);
      setGoal((goalRes.data as GoalRow | null) ?? null);
      setWeights(
        (weightsRes.data ?? []).map((w) => ({
          logged_at: w.logged_at as string,
          value_lb: Number(w.value_lb),
        })),
      );
    }
    setLoading(false);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Feed supabase rows into buildProjection exactly as the web page does.
  const projection = useMemo(() => {
    if (!goal) return null;
    return buildProjection({
      weights,
      startWeightLb: Number(goal.start_weight_lb),
      goalWeightLbMin: Number(goal.goal_weight_lb_min),
      goalWeightLbMax: Number(goal.goal_weight_lb_max),
      timelineWeeks: goal.timeline_weeks,
    });
  }, [goal, weights]);

  if (loading) return <Loading />;

  return (
    <Content>
      <View className="gap-1.5">
        <Text className="text-2xl font-semibold text-foreground">Projections</Text>
        <Text className="text-sm text-muted-foreground">
          Three linear trajectories vs. your actual data + 7-day moving average. Projection, not
          prediction — bodies don&apos;t do exact.
        </Text>
      </View>

      {error ? (
        <View className="mt-4">
          <ErrorState message={error} />
        </View>
      ) : !goal ? (
        <View className="mt-4">
          <EmptyState
            title="No goal set"
            hint="Set a goal in onboarding to see your projection."
          />
        </View>
      ) : !projection ? (
        <View className="mt-4">
          <EmptyState
            title="Not enough data"
            hint="Log a few weigh-ins to see projections."
          />
        </View>
      ) : (
        <ProjectionBody projection={projection} weights={weights} />
      )}
    </Content>
  );
}

function ProjectionBody({
  projection,
  weights,
}: {
  projection: ProjectionResult;
  weights: WeightPoint[];
}) {
  const adherence = ADHERENCE[projection.adherence];
  const { series } = projection;

  return (
    <View className="mt-5 gap-5">
      <View className="flex-row">
        <Pill label={adherence.label} tone={adherence.tone} />
      </View>

      <Card className="p-3">
        <ProjectionChart projection={projection} weights={weights} />
      </Card>

      <View className="flex-row flex-wrap gap-3">
        <RateBox label="Conservative" series={series.conservative} />
        <RateBox label="Target" series={series.target} />
        <RateBox label="Aggressive" series={series.aggressive} />
      </View>

      <View className="rounded-md border border-border bg-muted p-3">
        <Text className="text-xs leading-relaxed text-muted-foreground">
          <Text className="font-semibold text-foreground">How this is built. </Text>
          Target rate = (start − target midpoint) ÷ timeline weeks. Conservative ≈ 60% of target.
          Aggressive ≈ 115% of target. Lines are linear; real weight loss decelerates as you
          approach the target. Use this for orientation, not absolute prediction.
        </Text>
      </View>
    </View>
  );
}

function RateBox({
  label,
  series,
}: {
  label: string;
  series: ProjectionResult["series"]["target"];
}) {
  const eta =
    series.etaWeeks !== null ? `ETA ${series.etaWeeks} wk` : "ETA —";
  const etaDate = series.etaDate
    ? new Date(series.etaDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : undefined;
  return (
    <StatBox
      label={label}
      value={`${series.lbsPerWeek.toFixed(2)} lb/wk`}
      sub={etaDate ? `${eta} · ${etaDate}` : eta}
      className="min-w-[30%]"
    />
  );
}

// ---------------------------------------------------------------------------
// SVG chart (react-native-svg). Recharts isn't available in RN, so we hand-roll
// the same picture: shaded target band, 3 dashed projection lines, the 7-day MA
// line, and actual weigh-in dots. Fixed viewBox, full-width responsive svg.
// ---------------------------------------------------------------------------
const VB_W = 340;
const VB_H = 200;
const PAD_L = 34; // room for y labels
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 18; // room for x labels
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

interface DatePoint {
  date: string;
  lb: number;
}

function ProjectionChart({
  projection,
  weights,
}: {
  projection: ProjectionResult;
  weights: WeightPoint[];
}) {
  const { series, sevenDayMA, targetMinLb, targetMaxLb } = projection;

  // Gather every dated value to compute the shared x (time) and y (weight)
  // domains across actuals, the MA, and all three projection lines.
  const toMs = (d: string) => +new Date(d.length <= 10 ? `${d}T00:00:00` : d);

  const actualPts = useMemo(
    () => weights.map((w) => ({ ms: toMs(w.logged_at), lb: w.value_lb })),
    [weights],
  );
  const maPts = useMemo(
    () => sevenDayMA.map((w) => ({ ms: toMs(w.logged_at), lb: w.value_lb })),
    [sevenDayMA],
  );
  const lineToXY = (pts: DatePoint[]) =>
    pts.map((p) => ({ ms: toMs(p.date), lb: p.lb }));
  const conservative = useMemo(() => lineToXY(series.conservative.points), [series]);
  const target = useMemo(() => lineToXY(series.target.points), [series]);
  const aggressive = useMemo(() => lineToXY(series.aggressive.points), [series]);

  const { minMs, maxMs, minLb, maxLb } = useMemo(() => {
    const all = [...actualPts, ...maPts, ...conservative, ...target, ...aggressive];
    const msVals = all.map((p) => p.ms);
    const lbVals = all.map((p) => p.lb);
    lbVals.push(targetMinLb, targetMaxLb);
    return {
      minMs: Math.min(...msVals),
      maxMs: Math.max(...msVals),
      minLb: Math.floor(Math.min(...lbVals) - 2),
      maxLb: Math.ceil(Math.max(...lbVals) + 2),
    };
  }, [actualPts, maPts, conservative, target, aggressive, targetMinLb, targetMaxLb]);

  const msSpan = Math.max(1, maxMs - minMs);
  const lbSpan = Math.max(1, maxLb - minLb);
  const x = (ms: number) => PAD_L + ((ms - minMs) / msSpan) * PLOT_W;
  const y = (lb: number) => PAD_T + ((maxLb - lb) / lbSpan) * PLOT_H; // inverted

  const polyline = (pts: { ms: number; lb: number }[]) =>
    pts.map((p) => `${x(p.ms).toFixed(1)},${y(p.lb).toFixed(1)}`).join(" ");

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const bandTop = y(targetMaxLb);
  const bandBottom = y(targetMinLb);

  return (
    <View>
      <Svg width="100%" height={210} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* shaded target band */}
        <Rect
          x={PAD_L}
          y={Math.min(bandTop, bandBottom)}
          width={PLOT_W}
          height={Math.abs(bandBottom - bandTop)}
          fill={colors.accent}
          opacity={0.12}
        />
        <Line
          x1={PAD_L}
          y1={bandTop}
          x2={PAD_L + PLOT_W}
          y2={bandTop}
          stroke={colors.accent}
          strokeWidth={0.75}
          strokeDasharray="3 3"
          opacity={0.5}
        />
        <Line
          x1={PAD_L}
          y1={bandBottom}
          x2={PAD_L + PLOT_W}
          y2={bandBottom}
          stroke={colors.accent}
          strokeWidth={0.75}
          strokeDasharray="3 3"
          opacity={0.5}
        />

        {/* plot frame baseline + left axis */}
        <Line
          x1={PAD_L}
          y1={PAD_T}
          x2={PAD_L}
          y2={PAD_T + PLOT_H}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Line
          x1={PAD_L}
          y1={PAD_T + PLOT_H}
          x2={PAD_L + PLOT_W}
          y2={PAD_T + PLOT_H}
          stroke={colors.border}
          strokeWidth={1}
        />

        {/* projection lines (dashed, distinct strokes) */}
        <Polyline
          points={polyline(conservative)}
          fill="none"
          stroke={colors.mutedForeground}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <Polyline
          points={polyline(aggressive)}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <Polyline
          points={polyline(target)}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="4 4"
        />

        {/* 7-day moving average (solid) */}
        {maPts.length > 1 ? (
          <Polyline
            points={polyline(maPts)}
            fill="none"
            stroke={colors.foreground}
            strokeWidth={2}
          />
        ) : null}

        {/* actual weigh-ins (dots) */}
        {actualPts.map((p, i) => (
          <Circle key={i} cx={x(p.ms)} cy={y(p.lb)} r={2.4} fill={colors.foreground} />
        ))}

        {/* y axis min/max labels */}
        <SvgText x={PAD_L - 4} y={PAD_T + 4} fontSize={8} fill={colors.mutedForeground} textAnchor="end">
          {maxLb}
        </SvgText>
        <SvgText
          x={PAD_L - 4}
          y={PAD_T + PLOT_H}
          fontSize={8}
          fill={colors.mutedForeground}
          textAnchor="end"
        >
          {minLb}
        </SvgText>

        {/* x axis min/max labels */}
        <SvgText x={PAD_L} y={VB_H - 5} fontSize={8} fill={colors.mutedForeground} textAnchor="start">
          {fmtDate(minMs)}
        </SvgText>
        <SvgText
          x={PAD_L + PLOT_W}
          y={VB_H - 5}
          fontSize={8}
          fill={colors.mutedForeground}
          textAnchor="end"
        >
          {fmtDate(maxMs)}
        </SvgText>
      </Svg>

      {/* legend */}
      <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
        <LegendDot color={colors.foreground} label="7-day MA / actual" />
        <LegendDot color={colors.primary} label="Target" />
        <LegendDot color={colors.mutedForeground} label="Conservative" />
        <LegendDot color={colors.accent} label="Aggressive" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}
