import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EvidenceLevel } from "@peptide/shared";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { useTheme } from "@/lib/theme-context";
import { useSession } from "@/lib/session";
import {
  loadAlerts,
  acknowledgeAlert,
  snoozeAlert,
  type AlertRow,
  type AlertsView,
} from "@/lib/alerts";

type Severity = AlertRow["severity"];

const SEVERITY_ORDER: Severity[] = ["critical", "warn", "info"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warn: "Warning",
  info: "Info",
};

export default function Alerts() {
  const { session } = useSession();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const [view, setView] = useState<AlertsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setError(null);
      const v = await loadAlerts(uid);
      setView(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load alerts.");
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onAck(id: string) {
    if (!uid) return;
    setBusy(id);
    try {
      await acknowledgeAlert(uid, id);
      await load();
    } catch (e) {
      Alert.alert("Could not acknowledge", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  async function onSnooze(id: string) {
    if (!uid) return;
    setBusy(id);
    try {
      await snoozeAlert(uid, id, 7);
      await load();
    } catch (e) {
      Alert.alert("Could not snooze", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <Content className="gap-4">
        <ErrorState message={error} />
      </Content>
    );
  }
  if (!view) return <Loading />;

  const { active, history } = view;
  const grouped = SEVERITY_ORDER.map((sev) => ({
    sev,
    items: active.filter((a) => a.severity === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <Content className="gap-4">
      <Text className="text-xs text-muted-foreground">
        Patterns in your logged data to review with your clinician — not medical advice. RecompIQ
        flags signals like high blood pressure or glucose, rapid weight loss, or possible
        contraindications. It does not diagnose, prescribe, or tell you to change a dose.
      </Text>

      {active.length === 0 ? (
        <EmptyState
          title="No active alerts"
          hint="Nothing in your recent logs crossed a threshold. Keep logging so we can keep watch."
        />
      ) : (
        grouped.map((g) => (
          <View key={g.sev} className="gap-2">
            <Text className="text-sm font-semibold text-foreground">
              {SEVERITY_LABEL[g.sev]} · {g.items.length}
            </Text>
            {g.items.map((a) => (
              <AlertCard
                key={a.id}
                a={a}
                busy={busy === a.id}
                onAck={() => onAck(a.id)}
                onSnooze={() => onSnooze(a.id)}
              />
            ))}
          </View>
        ))
      )}

      {history.length > 0 ? (
        <View className="gap-2">
          <Pressable onPress={() => setHistoryOpen((v) => !v)}>
            <Text className="text-[12px] font-medium" style={{ color: colors.primary }}>
              {historyOpen ? "Hide" : "Show"} resolved &amp; snoozed ({history.length})
            </Text>
          </Pressable>
          {historyOpen
            ? history.map((a) => <HistoryRow key={a.id} a={a} />)
            : null}
        </View>
      ) : null}

      <SafetyDisclaimer variant="compact" />
    </Content>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  const { colors } = useTheme();
  const map: Record<Severity, { label: string; color: string }> = {
    critical: { label: "critical", color: colors.danger },
    warn: { label: "warning", color: colors.warn },
    info: { label: "info", color: colors.primary },
  };
  const { label, color } = map[severity];
  return (
    <View
      className="shrink-0 self-start"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text className="text-[10px] font-semibold uppercase" style={{ color, letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}

function AlertCard({
  a,
  busy,
  onAck,
  onSnooze,
}: {
  a: AlertRow;
  busy: boolean;
  onAck: () => void;
  onSnooze: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-foreground">{a.title}</Text>
        <SeverityPill severity={a.severity} />
      </View>
      <Text className="text-[13px] leading-5 text-muted-foreground">{a.message}</Text>

      <View className="flex-row flex-wrap items-center gap-2 pt-0.5">
        <EvidenceBadge level={a.evidence_level as EvidenceLevel} />
        <Text className="flex-1 text-[10.5px] text-muted-foreground">{a.citation}</Text>
      </View>

      <View className="mt-1 flex-row gap-2 border-t border-border pt-2.5">
        <Pressable
          onPress={onAck}
          disabled={busy}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-border py-2 active:opacity-70"
        >
          <Ionicons name="checkmark-circle-outline" size={15} color={colors.foreground} />
          <Text className="text-[12px] font-medium text-foreground">Acknowledge</Text>
        </Pressable>
        <Pressable
          onPress={onSnooze}
          disabled={busy}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-border py-2 active:opacity-70"
        >
          <Ionicons name="time-outline" size={15} color={colors.fgSubtle} />
          <Text className="text-[12px] font-medium" style={{ color: colors.fgSubtle }}>
            Snooze 7d
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function HistoryRow({ a }: { a: AlertRow }) {
  const { colors } = useTheme();
  const state =
    a.status === "resolved"
      ? "Resolved"
      : a.status === "acknowledged"
        ? "Acknowledged"
        : "Snoozed";
  return (
    <Card className="gap-1">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[13px] font-medium text-foreground">{a.title}</Text>
        <Text className="text-[10px] uppercase" style={{ color: colors.mutedForeground, letterSpacing: 0.6 }}>
          {state}
        </Text>
      </View>
      <Text className="text-[12px] leading-4 text-muted-foreground">{a.message}</Text>
    </Card>
  );
}
