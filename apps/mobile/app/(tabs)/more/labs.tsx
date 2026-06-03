import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  LAB_MARKER_DEFS,
  LAB_MARKER_BY_KEY,
  matchMarkerKey,
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
import { apiFetch, apiUpload } from "@/lib/api";
import { loadLabs, addManualLab, addOcrLabs, deleteLab, type LabReadingRow } from "@/lib/labs";

// OCR parse response (mirrors /api/labs/parse).
interface EnrichedMarker {
  marker_key: string | null;
  marker: string;
  raw_name: string;
  panel: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_source: string;
  status: RangeStatus;
}
interface ParseResult {
  collected_on: string | null;
  results: EnrichedMarker[];
  ocr_raw: unknown;
  model_used: string;
  provider_used: string;
}

// An editable row in the OCR review list. Values are kept as strings while
// editing; recomputed status is derived on render.
interface ReviewRow {
  markerKey: string | null;
  marker: string;
  panel: string | null;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  include: boolean;
}

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

  // OCR scan flow
  const [scanState, setScanState] = useState<"idle" | "uploading" | "parsing">("idle");
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [reviewDate, setReviewDate] = useState(todayStr());
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState<string | null>(null);
  const [reviewModel, setReviewModel] = useState<string | null>(null);
  const [savingScan, setSavingScan] = useState(false);

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

  // ── OCR scan flow ──────────────────────────────────────────────────────────
  async function runParse(blobUrl: string, kind: "image" | "pdf") {
    setScanState("parsing");
    try {
      const data = await apiFetch<ParseResult>("/api/labs/parse", {
        method: "POST",
        body: JSON.stringify({ blob_url: blobUrl, kind }),
      });
      if (!data.results.length) {
        Alert.alert(
          "Nothing found",
          "No numeric lab results were found. Try a clearer photo, or add markers by hand below.",
        );
        setScanState("idle");
        return;
      }
      setReviewRows(
        data.results.map((r) => ({
          markerKey: r.marker_key,
          marker: r.marker,
          panel: r.panel,
          value: String(r.value),
          unit: r.unit ?? "",
          refLow: r.ref_low != null ? String(r.ref_low) : "",
          refHigh: r.ref_high != null ? String(r.ref_high) : "",
          include: true,
        })),
      );
      setReviewDate(data.collected_on ?? todayStr());
      setReviewPhotoUrl(blobUrl);
      setReviewModel(data.model_used);
      setScanState("idle");
    } catch (e) {
      Alert.alert("Could not read report", e instanceof Error ? e.message : "Unknown error");
      setScanState("idle");
    }
  }

  async function scanPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        fromCamera
          ? "Camera access is required to photograph a report."
          : "Photo library access is required to choose a report photo.",
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (result.canceled || !result.assets[0]) return;
    setScanState("uploading");
    try {
      const form = new FormData();
      form.append("file", { uri: result.assets[0].uri, name: "report.jpg", type: "image/jpeg" } as never);
      const data = await apiUpload<{ blob_url: string; kind: "image" | "pdf" }>("/api/labs/upload", form);
      await runParse(data.blob_url, data.kind);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
      setScanState("idle");
    }
  }

  async function scanPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setScanState("uploading");
    try {
      const form = new FormData();
      form.append(
        "file",
        { uri: asset.uri, name: asset.name || "report.pdf", type: "application/pdf" } as never,
      );
      const data = await apiUpload<{ blob_url: string; kind: "image" | "pdf" }>("/api/labs/upload", form);
      await runParse(data.blob_url, data.kind);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
      setScanState("idle");
    }
  }

  function updateReviewRow(i: number, patch: Partial<ReviewRow>) {
    setReviewRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  }

  function discardReview() {
    setReviewRows(null);
    setReviewPhotoUrl(null);
    setReviewModel(null);
  }

  async function saveReview() {
    if (!uid || !reviewRows) return;
    const rows = reviewRows
      .filter(
        (r) =>
          r.include && r.marker.trim() && r.value.trim() !== "" && !Number.isNaN(Number(r.value)),
      )
      .map((r) => {
        const key = r.markerKey ?? matchMarkerKey(r.marker);
        const def = key ? LAB_MARKER_BY_KEY[key] : undefined;
        return {
          markerKey: key,
          marker: r.marker.trim(),
          panel: r.panel ?? def?.panel ?? null,
          value: Number(r.value),
          unit: r.unit.trim() || null,
          refLow: r.refLow.trim() !== "" ? Number(r.refLow) : null,
          refHigh: r.refHigh.trim() !== "" ? Number(r.refHigh) : null,
        };
      });
    if (rows.length === 0) {
      Alert.alert("Nothing to save", "Every marker is skipped or empty.");
      return;
    }
    setSavingScan(true);
    try {
      await addOcrLabs(uid, rows, { collectedOn: reviewDate, photoUrl: reviewPhotoUrl });
      discardReview();
      await load();
      Alert.alert("Saved", `Saved ${rows.length} marker${rows.length === 1 ? "" : "s"}.`);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSavingScan(false);
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
        Track your own biomarkers. Scan a report photo or PDF to transcribe the printed values, or
        add markers by hand. Out-of-range values are flagged for clinician discussion — RecompIQ
        does not interpret results.
      </Text>

      {/* OCR scan / review */}
      {reviewRows ? (
        <ReviewCard
          rows={reviewRows}
          date={reviewDate}
          model={reviewModel}
          saving={savingScan}
          onSetDate={setReviewDate}
          onUpdate={updateReviewRow}
          onSave={saveReview}
          onDiscard={discardReview}
        />
      ) : (
        <Card className="gap-3">
          <Text className="text-sm font-semibold text-foreground">Scan a report</Text>
          <Text className="text-xs text-muted-foreground">
            Photo or PDF. We transcribe the printed values for you to review before saving. Nothing
            is interpreted.
          </Text>
          {scanState === "idle" ? (
            <>
              <Button title="Take photo" onPress={() => scanPhoto(true)} />
              <Button title="Choose photo" variant="outline" onPress={() => scanPhoto(false)} />
              <Button title="Choose PDF" variant="outline" onPress={scanPdf} />
            </>
          ) : (
            <View className="flex-row items-center gap-2 py-2">
              <Ionicons name="hourglass-outline" size={16} color="#888" />
              <Text className="text-sm text-muted-foreground">
                {scanState === "uploading" ? "Uploading…" : "Reading your report… (10–30 s)"}
              </Text>
            </View>
          )}
        </Card>
      )}

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

function ReviewCard({
  rows,
  date,
  model,
  saving,
  onSetDate,
  onUpdate,
  onSave,
  onDiscard,
}: {
  rows: ReviewRow[];
  date: string;
  model: string | null;
  saving: boolean;
  onSetDate: (d: string) => void;
  onUpdate: (i: number, patch: Partial<ReviewRow>) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const kept = rows.filter((r) => r.include).length;
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Review &amp; confirm</Text>
        <Text className="text-[11px] text-muted-foreground">
          {kept} of {rows.length} markers
        </Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        Check each value against your report. Edit anything the reader got wrong, skip rows you
        don&apos;t want, then save. These are your own values — RecompIQ only flags what falls outside
        a typical range, it does not interpret results.
      </Text>
      {model ? (
        <Text className="text-[11px] text-muted-foreground">
          Read by <Text className="font-medium text-foreground">{model}</Text>
        </Text>
      ) : null}

      <Field label="Collected on">
        <Input value={date} onChangeText={onSetDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      </Field>

      <View className="gap-2">
        {rows.map((r, i) => (
          <ReviewRowItem key={i} row={r} onUpdate={(patch) => onUpdate(i, patch)} />
        ))}
      </View>

      <SafetyDisclaimer variant="compact" />

      <View className="flex-row gap-3">
        <Button title="Discard" variant="outline" onPress={onDiscard} className="flex-1" />
        <Button
          title={saving ? "Saving…" : `Save ${kept} marker${kept === 1 ? "" : "s"}`}
          onPress={onSave}
          disabled={saving || kept === 0}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

function ReviewRowItem({
  row,
  onUpdate,
}: {
  row: ReviewRow;
  onUpdate: (patch: Partial<ReviewRow>) => void;
}) {
  const lo = row.refLow.trim() !== "" ? Number(row.refLow) : null;
  const hi = row.refHigh.trim() !== "" ? Number(row.refHigh) : null;
  const val =
    row.value.trim() !== "" && !Number.isNaN(Number(row.value)) ? Number(row.value) : null;
  const status: RangeStatus = val != null ? rangeStatus(val, lo, hi) : "unknown";
  return (
    <View
      className={`gap-2 rounded-lg border border-border p-2.5 ${row.include ? "" : "opacity-50"}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {row.marker}
        </Text>
        <StatusPill status={status} />
        <Pressable
          onPress={() => onUpdate({ include: !row.include })}
          hitSlop={8}
          className="rounded-md border border-border p-1.5 active:bg-muted"
        >
          <Ionicons name={row.include ? "close" : "add"} size={14} color="#888" />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label="Value">
            <Input
              value={row.value}
              onChangeText={(t) => onUpdate({ value: t })}
              placeholder="0"
              keyboardType="decimal-pad"
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Unit">
            <Input
              value={row.unit}
              onChangeText={(t) => onUpdate({ unit: t })}
              placeholder="mg/dL"
              autoCapitalize="none"
            />
          </Field>
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label="Ref low">
            <Input
              value={row.refLow}
              onChangeText={(t) => onUpdate({ refLow: t })}
              placeholder="low"
              keyboardType="decimal-pad"
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Ref high">
            <Input
              value={row.refHigh}
              onChangeText={(t) => onUpdate({ refHigh: t })}
              placeholder="high"
              keyboardType="decimal-pad"
            />
          </Field>
        </View>
      </View>
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
