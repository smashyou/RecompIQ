import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { PanResponder, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { buildTimelineModel, loadTimeline, type TimelineRange } from "@/lib/timeline";
import type { TimelineInput } from "@peptide/shared/timeline";
import { Content } from "@/components/ui/Content";
import { Card } from "@/components/ui/Card";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { colors } from "@/lib/theme";
import { useSession } from "@/lib/session";

const VB_W = 1000;
const LANE_H = 44;

const TONE: Record<string, string> = {
  neutral: colors.mutedForeground,
  good: colors.primary,
  warn: colors.primary,
  bad: colors.destructive,
  accent: colors.primary,
};

const PRESETS: { key: string; label: string }[] = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ytd", label: "Year" },
  { key: "all", label: "All" },
];

function rangeFor(key: string): TimelineRange {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to };
  if (key === "all") return { from: "2020-01-01", to };
  return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10), to };
}

export default function Timeline() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [rangeKey, setRangeKey] = useState("90d");
  const [data, setData] = useState<TimelineInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frac, setFrac] = useState<number | null>(null);
  const widthRef = useRef(1);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!uid) return;
      setLoading(true);
      setError(false);
      loadTimeline(uid, rangeFor(rangeKey))
        .then((d) => alive && setData(d))
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [uid, rangeKey]),
  );

  const model = useMemo(() => (data ? buildTimelineModel(data) : null), [data]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.locationX;
          setFrac(Math.min(1, Math.max(0, x / Math.max(1, widthRef.current))));
        },
        onPanResponderRelease: () => {},
      }),
    [],
  );

  const focusISO = useMemo(() => {
    if (!model || frac === null) return null;
    const startMs = +new Date(`${model.startISO}T00:00:00`);
    const endMs = +new Date(`${model.endISO}T23:59:59`);
    return new Date(startMs + (endMs - startMs) * frac).toISOString().slice(0, 10);
  }, [model, frac]);

  return (
    <Content>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>Timeline</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
        Everything you track over one date range. Drag across to read a day. Read-only — no advice.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {PRESETS.map((p) => {
          const active = p.key === rangeKey;
          return (
            <Text
              key={p.key}
              onPress={() => setRangeKey(p.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                overflow: "hidden",
                fontSize: 12,
                fontWeight: "600",
                color: active ? colors.primary : colors.mutedForeground,
                backgroundColor: active ? colors.primaryWash ?? "rgba(0,0,0,0.04)" : "transparent",
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              {p.label}
            </Text>
          );
        })}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message="Couldn't load your timeline. Pull back and try again." />
      ) : !model || model.lanes.length === 0 ? (
        <EmptyState
          title="Nothing logged in this range"
          hint="Log weight, food, doses, or training to see your timeline."
        />
      ) : (
        <>
          {/* readout */}
          <Card>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
              {focusISO
                ? new Date(`${focusISO}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "Drag across to read a day"}
            </Text>
            {model.lanes.map((l) => (
              <View key={l.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{l.label}</Text>
                <Text style={{ color: colors.foreground, fontSize: 11, fontVariant: ["tabular-nums"] }}>
                  {(focusISO && l.readAt(focusISO)) || "—"}
                </Text>
              </View>
            ))}
          </Card>

          {/* lanes */}
          <Card>
            <View
              {...pan.panHandlers}
              onLayout={(e) => {
                widthRef.current = e.nativeEvent.layout.width;
              }}
            >
              {model.lanes.map((lane) => (
                <View key={lane.key} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 10, fontWeight: "600" }}>
                    {lane.label} <Text style={{ color: colors.mutedForeground }}>· {lane.summary}</Text>
                  </Text>
                  <Svg width="100%" height={LANE_H} viewBox={`0 0 ${VB_W} ${LANE_H}`} preserveAspectRatio="none">
                    <LaneBody lane={lane} />
                    {frac !== null && (
                      <Line x1={frac * VB_W} y1={0} x2={frac * VB_W} y2={LANE_H} stroke={colors.primary} strokeWidth={1} />
                    )}
                  </Svg>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Content>
  );
}

function LaneBody({ lane }: { lane: ReturnType<typeof buildTimelineModel>["lanes"][number] }) {
  if (lane.kind === "line") {
    const pts = (lane.line ?? []).map((p) => `${(p.frac * VB_W).toFixed(1)},${((1 - p.vFrac) * (LANE_H - 8) + 4).toFixed(1)}`).join(" ");
    return (
      <>
        {(lane.line ?? []).length > 1 && <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={2} />}
        {(lane.line ?? []).map((p, i) => (
          <Circle key={i} cx={p.frac * VB_W} cy={(1 - p.vFrac) * (LANE_H - 8) + 4} r={3} fill={colors.primary} />
        ))}
      </>
    );
  }
  if (lane.kind === "bars") {
    return (
      <>
        {(lane.bars ?? []).map((b, i) => {
          const h = Math.max(1, b.vFrac * (LANE_H - 6));
          return <Rect key={i} x={b.frac * VB_W - 3} y={LANE_H - h - 2} width={6} height={h} rx={1} fill={colors.primary} opacity={0.55} />;
        })}
      </>
    );
  }
  if (lane.kind === "events" || lane.kind === "markers") {
    const cy = LANE_H / 2;
    return (
      <>
        {(lane.events ?? []).map((e, i) =>
          lane.kind === "markers" ? (
            <Rect key={i} x={e.frac * VB_W - 4} y={cy - 6} width={8} height={12} rx={2} fill={TONE[e.tone]} />
          ) : (
            <Circle key={i} cx={e.frac * VB_W} cy={cy} r={4} fill={TONE[e.tone]} />
          ),
        )}
      </>
    );
  }
  if (lane.kind === "intervals") {
    const rows = lane.rowCount ?? 1;
    const rowH = (LANE_H - 4) / Math.max(1, rows);
    return (
      <>
        {(lane.intervals ?? []).map((seg, i) => (
          <Rect key={i} x={seg.x0 * VB_W} y={2 + seg.row * rowH + 1} width={Math.max(3, (seg.x1 - seg.x0) * VB_W)} height={rowH - 2} rx={2} fill={TONE[seg.tone]} opacity={0.35} />
        ))}
      </>
    );
  }
  return null;
}
