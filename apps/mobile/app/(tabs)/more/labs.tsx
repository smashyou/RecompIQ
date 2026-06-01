import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  LAB_MARKER_DEFS,
  LAB_MARKER_BY_KEY,
  rangeStatus,
  formatLabValue,
  type MarkerSeries,
  type RangeStatus,
} from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Loading, EmptyState } from "@/components/ui/States";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { useTheme } from "@/lib/theme-context";
import { useSession } from "@/lib/session";
import { loadLabs, addManualLab, deleteLab, type LabReadingRow } from "@/lib/labs";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Labs() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [series, setSeries] = useState<MarkerSeries[] | null>(null);

  const [query, setQuery] = useState("");
  const [markerKey, setMarkerKey] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { series } = await loadLabs(uid);
    setSeries(series);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || markerKey) return [];
    return LAB_MARKER_DEFS.filter(
      (m) => m.label.toLowerCase().includes(q) || m.aliases.some((a) => a.includes(q)),
    ).slice(0, 6);
  }, [query, markerKey]);

  const selectedLabel = markerKey ? LAB_MARKER_BY_KEY[markerKey]?.label : null;

  function pick(key: string) {
    setMarkerKey(key);
    const def = LAB_MARKER_BY_KEY[key];
    if (def) setUnit(def.unit);
    setQuery("");
  }

  function clearMarker() {
    setMarkerKey(null);
    setCustomName("");
    setUnit("");
  }

  async function save() {
    if (!uid) return;
    const name = selectedLabel ?? customName.trim();
    if (!name) return Alert.alert("Pick a marker", "Choose a marker or type a custom name.");
    if (value.trim() === "" || Number.isNaN(Number(value)))
      return Alert.alert("Value", "Enter a numeric value.");
    setSaving(true);
    try {
      await addManualLab(uid, {
        markerKey,
        customName,
        value: Number(value),
        unit: unit.trim() || null,
        collectedOn: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr(),
      });
      setValue("");
      setDate(todayStr());
      clearMarker();
      await load();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  function removeReading(r: LabReadingRow, label: string) {
    Alert.alert("Delete reading", `Delete the ${label} reading from ${r.collected_on}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!uid) return;
          await deleteLab(uid, r.id);
          load();
        },
      },
    ]);
  }

  if (!series) return <Loading />;

  return (
    <Content className="gap-4">
      <Text className="text-xs text-muted-foreground">
        Track your own biomarkers. Out-of-range values are flagged for clinician discussion —
        RecompIQ does not interpret results. Report photo/PDF scanning is on the web app.
      </Text>

      {/* Manual entry */}
      <Card className="gap-3">
        <Text className="text-sm font-semibold text-foreground">Add a marker</Text>
        {markerKey || customName ? (
          <View className="flex-row items-center justify-between rounded-lg border border-border bg-muted p-3">
            <Text className="text-sm text-foreground">{selectedLabel ?? customName}</Text>
            <Pressable onPress={clearMarker}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </Pressable>
          </View>
        ) : (
          <>
            <Field label="Marker">
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder="Search e.g. A1c, LDL, TSH…"
                autoCapitalize="none"
              />
            </Field>
            {matches.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => pick(m.key)}
                className="rounded-lg border border-border bg-muted p-3 active:opacity-70"
              >
                <Text className="text-sm text-foreground">
                  + {m.label} <Text className="text-xs text-muted-foreground">({m.unit})</Text>
                </Text>
              </Pressable>
            ))}
            {query.trim() && matches.length === 0 ? (
              <Pressable
                onPress={() => setCustomName(query.trim())}
                className="rounded-lg border border-border bg-muted p-3 active:opacity-70"
              >
                <Text className="text-sm text-foreground">+ Use &quot;{query.trim()}&quot; as custom</Text>
              </Pressable>
            ) : null}
          </>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Value">
              <Input value={value} onChangeText={setValue} placeholder="0" keyboardType="decimal-pad" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Unit">
              <Input value={unit} onChangeText={setUnit} placeholder="mg/dL" autoCapitalize="none" />
            </Field>
          </View>
        </View>
        <Field label="Collected on">
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </Field>
        <Button title={saving ? "Saving…" : "Save marker"} onPress={save} disabled={saving} />
      </Card>

      {/* Marker history */}
      {series.length === 0 ? (
        <EmptyState title="No labs yet" hint="Add a marker above to start tracking trends." />
      ) : (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Your markers · {series.length}</Text>
          {series.map((s) => (
            <MarkerCard key={s.key} s={s} onDelete={removeReading} />
          ))}
        </View>
      )}

      <SafetyDisclaimer variant="compact" />
    </Content>
  );
}

function StatusPill({ status }: { status: RangeStatus }) {
  const { colors } = useTheme();
  const map: Record<RangeStatus, { label: string; color: string }> = {
    in: { label: "in range", color: colors.positive },
    high: { label: "high", color: colors.warn },
    low: { label: "low", color: colors.warn },
    unknown: { label: "no range", color: colors.mutedForeground },
  };
  const { label, color } = map[status];
  return (
    <View
      className="shrink-0 self-start"
      style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: color }}
    >
      <Text className="text-[10px] font-semibold uppercase" style={{ color, letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}

function MarkerCard({
  s,
  onDelete,
}: {
  s: MarkerSeries;
  onDelete: (r: LabReadingRow, label: string) => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const rangeText =
    s.effLow != null || s.effHigh != null
      ? `ref ${s.effLow ?? "–"}–${s.effHigh ?? "–"}${s.unit ? ` ${s.unit}` : ""}${s.refSource === "catalog" ? " (typical)" : ""}`
      : "no reference range";
  return (
    <Card className="gap-1.5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold text-foreground">{s.marker}</Text>
          {s.panelLabel ? <Text className="text-[11px] text-muted-foreground">{s.panelLabel}</Text> : null}
        </View>
        <StatusPill status={s.status} />
      </View>
      <View className="flex-row items-end justify-between">
        <Text className="text-xl font-semibold text-foreground">
          {formatLabValue(s.latest.value, s.decimals)}
          {s.unit ? <Text className="text-xs text-muted-foreground"> {s.unit}</Text> : null}
        </Text>
        <Text className="text-[11px] text-muted-foreground">{s.latest.collected_on}</Text>
      </View>
      <Text className="text-[11px] text-muted-foreground">{rangeText}</Text>
      {s.refSource === "catalog" && s.sexSpecific ? (
        <Text className="text-[10px]" style={{ color: colors.warn }}>
          Sex-specific range — discuss with your clinician.
        </Text>
      ) : null}

      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text className="text-[11px] font-medium text-primary">
          {expanded ? "Hide" : `History (${s.readings.length})`}
        </Text>
      </Pressable>
      {expanded ? (
        <View className="gap-1 border-t border-border pt-1.5">
          {[...s.readings].reverse().map((r) => {
            const st = rangeStatus(r.value, r.ref_low ?? s.effLow, r.ref_high ?? s.effHigh);
            return (
              <View key={r.id} className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">{r.collected_on}</Text>
                <View className="flex-row items-center gap-3">
                  <Text
                    className="text-xs"
                    style={{ color: st === "low" || st === "high" ? colors.warn : colors.foreground }}
                  >
                    {formatLabValue(r.value, s.decimals)}
                  </Text>
                  {r.source === "manual" ? (
                    <Text className="text-[9px] uppercase text-muted-foreground">man</Text>
                  ) : null}
                  <Pressable onPress={() => onDelete(r, s.marker)}>
                    <Ionicons name="trash-outline" size={15} color="#999" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
