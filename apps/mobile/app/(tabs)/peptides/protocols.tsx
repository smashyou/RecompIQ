import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DOSE_UNIT, ROUTE, type EvidenceLevel } from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Loading, EmptyState } from "@/components/ui/States";
import { CompoundPicker } from "@/components/peptides/CompoundPicker";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { usePeptideSelection } from "@/lib/peptide-selection";
import { colors } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

// ---------- shared types ----------
interface DoseRef {
  id: string;
  context: string;
  route: string | null;
  low_value: number | null;
  high_value: number | null;
  unit: string;
  frequency: string | null;
  evidence_level: EvidenceLevel;
  is_human_data: boolean;
  citation: { source?: string; title?: string; url?: string; year?: number }[] | null;
  notes: string | null;
}
interface Synergy {
  id: string;
  paired_name: string;
  rationale: string;
  evidence_level: EvidenceLevel;
  is_human_data: boolean;
  caution_notes: string | null;
}
interface RefCompound {
  id: string;
  slug: string;
  name: string;
  evidence_level: EvidenceLevel;
  fda_approved: boolean;
  mechanism: string | null;
  monitoring_notes: string[];
  references: DoseRef[];
  synergies: Synergy[];
}
interface ScheduleWeek {
  id: string;
  week_number: number;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  compounds: { name: string } | null;
}
interface Schedule {
  id: string;
  name: string;
  phase: string | null;
  start_on: string | null;
  protocol_schedule_weeks: ScheduleWeek[];
}

function rangeText(r: DoseRef): string {
  const u = r.unit;
  if (r.low_value != null && r.high_value != null)
    return r.low_value === r.high_value ? `${r.low_value} ${u}` : `${r.low_value}–${r.high_value} ${u}`;
  if (r.low_value != null) return `from ${r.low_value} ${u}`;
  if (r.high_value != null) return `up to ${r.high_value} ${u}`;
  return "no established range";
}

const TABS = [
  { value: "reference", label: "Reference" },
  { value: "builder", label: "Builder" },
  { value: "titration", label: "Titration" },
] as const;

export default function Protocols() {
  const router = useRouter();
  const { session } = useSession();
  const sel = usePeptideSelection();
  const { compound: compoundSlug, tab: tabParam } = useLocalSearchParams<{ compound?: string; tab?: string }>();
  const [tab, setTab] = useState<string>(
    TABS.some((t) => t.value === tabParam) ? (tabParam as string) : "reference",
  );

  // Deep-link (?compound=slug) initializes the shared peptide selection.
  useEffect(() => {
    if (compoundSlug) sel.setSlug(compoundSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundSlug]);
  const [refCompounds, setRefCompounds] = useState<RefCompound[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pickerOptions, setPickerOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: comps }, { data: refs }, { data: syns }, { data: scheds }] = await Promise.all([
      supabase.from("compounds").select("id, slug, name, evidence_level, fda_approved, mechanism, monitoring_notes").order("name"),
      supabase.from("compound_dose_reference").select("*").order("context"),
      supabase.from("compound_synergies").select("id, compound_id, paired_name, rationale, evidence_level, is_human_data, caution_notes").order("paired_name"),
      supabase.from("protocol_schedules").select("*, protocol_schedule_weeks(*, compounds(name))").order("created_at", { ascending: false }),
    ]);
    const refsBy = new Map<string, DoseRef[]>();
    for (const r of (refs ?? []) as any[]) {
      const list = refsBy.get(r.compound_id) ?? [];
      list.push(r as DoseRef);
      refsBy.set(r.compound_id, list);
    }
    const synBy = new Map<string, Synergy[]>();
    for (const s of (syns ?? []) as any[]) {
      const list = synBy.get(s.compound_id) ?? [];
      list.push(s as Synergy);
      synBy.set(s.compound_id, list);
    }
    setRefCompounds(
      ((comps ?? []) as any[]).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        evidence_level: c.evidence_level,
        fda_approved: c.fda_approved,
        mechanism: c.mechanism,
        monitoring_notes: c.monitoring_notes ?? [],
        references: refsBy.get(c.id) ?? [],
        synergies: synBy.get(c.id) ?? [],
      })),
    );
    setPickerOptions(((comps ?? []) as any[]).map((c) => ({ id: c.id, name: c.name })));
    setSchedules((scheds ?? []) as unknown as Schedule[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  return (
    <Content className="gap-4">
      <Pressable
        onPress={() => router.push("/(tabs)/peptides/reconstitution")}
        className="flex-row items-center justify-between rounded-xl border border-border bg-card p-3 active:opacity-70"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="flask-outline" size={18} color={colors.primary} />
          <Text className="text-sm font-medium text-foreground">Reconstitution calculator</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Segmented options={TABS} value={tab} onChange={setTab} fill />

      {tab === "reference" ? (
        <ReferenceTab
          compounds={refCompounds}
          cameFromSlug={sel.slug ?? undefined}
          onExpand={(slug) => sel.setSlug(slug)}
          onUseInCalculator={(slug) => {
            sel.setSlug(slug);
            router.push({ pathname: "/(tabs)/peptides/reconstitution", params: { compound: slug } });
          }}
        />
      ) : tab === "builder" ? (
        <BuilderTab
          options={pickerOptions}
          defaultCompoundId={refCompounds.find((c) => c.slug === sel.slug)?.id}
          userId={session?.user.id}
          onSaved={async () => {
            await load();
            setTab("titration");
          }}
        />
      ) : (
        <TitrationTab schedules={schedules} onDeleted={load} />
      )}
    </Content>
  );
}

// ---------- Compound Reference ----------
function ReferenceTab({
  compounds,
  cameFromSlug,
  onExpand,
  onUseInCalculator,
}: {
  compounds: RefCompound[];
  cameFromSlug?: string;
  onExpand: (slug: string) => void;
  onUseInCalculator: (slug: string) => void;
}) {
  const { type } = useResponsive();
  const initialOpen = useMemo(() => {
    if (cameFromSlug) {
      const m = compounds.find((c) => c.slug === cameFromSlug);
      if (m) return m.id;
    }
    return compounds[0]?.id ?? null;
  }, [compounds, cameFromSlug]);
  const [open, setOpen] = useState<string | null>(initialOpen);

  return (
    <View className="gap-3">
      <Text className="text-xs leading-snug text-muted-foreground">
        Literature dose ranges are educational reference only — graded by evidence quality and cited. A
        starting point for a clinician discussion, not a prescription.
      </Text>
      {compounds.map((c) => {
        const isOpen = open === c.id;
        return (
          <View key={c.id} className="rounded-xl border border-border bg-card">
            <Pressable
              onPress={() => {
                const next = isOpen ? null : c.id;
                setOpen(next);
                if (next) onExpand(c.slug);
              }}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-1 flex-row items-center gap-2">
                <Text numberOfLines={1} className="flex-shrink font-semibold text-foreground" style={{ fontSize: type.lg }}>{c.name}</Text>
                <View style={{ flexShrink: 0 }}>
                  <EvidenceBadge level={c.evidence_level} />
                </View>
              </View>
              <Ionicons name={isOpen ? "remove" : "add"} size={18} color={colors.mutedForeground} />
            </Pressable>
            {isOpen ? (
              <View className="gap-3 border-t border-border p-4">
                {c.mechanism ? <Text className="text-sm text-muted-foreground">{c.mechanism}</Text> : null}
                {c.references.length === 0 ? (
                  <Text className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No literature ranges loaded yet. Use the calculator with your own / your clinician's values.
                  </Text>
                ) : (
                  c.references.map((ref) => (
                    <View key={ref.id} className="gap-1 rounded-lg border border-border p-3">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 text-sm font-medium capitalize text-foreground">{ref.context}</Text>
                        <View className="flex-row items-center gap-1">
                          <EvidenceBadge level={ref.evidence_level} />
                          {!ref.is_human_data ? <Pill label="non-human" /> : null}
                        </View>
                      </View>
                      <Text className="text-base text-primary">
                        {rangeText(ref)}
                        {ref.frequency ? <Text className="text-sm text-muted-foreground">, {ref.frequency}</Text> : null}
                      </Text>
                      {ref.route ? <Text className="text-xs uppercase text-muted-foreground">route: {ref.route}</Text> : null}
                      {ref.notes ? <Text className="text-xs text-muted-foreground">{ref.notes}</Text> : null}
                      {ref.low_value !== null ? (
                        <Pressable onPress={() => onUseInCalculator(c.slug)} className="mt-2 self-start rounded-md border border-primary px-3 py-1.5 active:bg-muted">
                          <Text className="text-xs font-medium text-primary">Open in calculator</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
                {c.monitoring_notes.length > 0 ? (
                  <View className="gap-1">
                    <Text className="text-sm font-medium text-foreground">Monitoring</Text>
                    {c.monitoring_notes.map((n, i) => (
                      <Text key={i} className="text-xs text-muted-foreground">• {n}</Text>
                    ))}
                  </View>
                ) : null}
                {c.synergies.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Commonly combined with</Text>
                    <Text className="text-xs text-muted-foreground">
                      Educational rationale only — review any combination with a clinician.
                    </Text>
                    {c.synergies.map((s) => (
                      <View key={s.id} className="gap-1 rounded-lg border border-border p-3">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 text-sm font-medium text-foreground">{s.paired_name}</Text>
                          <EvidenceBadge level={s.evidence_level} />
                        </View>
                        <Text className="text-xs text-muted-foreground">{s.rationale}</Text>
                        {s.caution_notes ? <Text className="text-xs text-destructive">Caution: {s.caution_notes}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------- Protocol Builder ----------
interface WeekRow {
  compound_id: string;
  week_number: number;
  dose_value: string;
  dose_unit: string;
  route: string;
  frequency: string;
}
const UNIT_OPTS = DOSE_UNIT.map((u) => ({ value: u, label: u }));
const ROUTE_OPTS = ROUTE.filter((r) => ["sc", "im", "oral", "nasal", "other"].includes(r)).map((r) => ({ value: r, label: r.toUpperCase() }));

function BuilderTab({
  options,
  defaultCompoundId,
  userId,
  onSaved,
}: {
  options: { id: string; name: string }[];
  defaultCompoundId?: string;
  userId?: string;
  onSaved: () => void;
}) {
  const first = defaultCompoundId || options[0]?.id || "";
  const [name, setName] = useState("");
  const [rows, setRows] = useState<WeekRow[]>([
    { compound_id: first, week_number: 1, dose_value: "", dose_unit: "mg", route: "sc", frequency: "weekly" },
  ]);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<WeekRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      { compound_id: last?.compound_id ?? first, week_number: (last?.week_number ?? 0) + 1, dose_value: last?.dose_value ?? "", dose_unit: last?.dose_unit ?? "mg", route: last?.route ?? "sc", frequency: last?.frequency ?? "weekly" },
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!userId) return;
    if (!name.trim()) return Alert.alert("Name required", "Give the protocol a name.");
    const weeks = rows
      .filter((r) => r.compound_id && Number(r.dose_value) > 0)
      .map((r) => ({ compound_id: r.compound_id, week_number: r.week_number, dose_value: Number(r.dose_value), dose_unit: r.dose_unit, route: r.route, frequency: r.frequency || "weekly" }));
    if (weeks.length === 0) return Alert.alert("Add a week", "Add at least one week with a compound + dose.");
    setSaving(true);
    try {
      await apiFetch("/api/protocols", { method: "POST", body: JSON.stringify({ name: name.trim(), weeks }) });
      Alert.alert("Saved", "Protocol saved.");
      onSaved();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">
        Build your own (or your clinician's) week-by-week titration plan. All values are yours — the app stores them, it doesn't prescribe.
      </Text>
      <Field label="Protocol name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Reta ramp — weeks 1–8" />
      </Field>
      {rows.map((r, i) => (
        <Card key={i} className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">Week {r.week_number}</Text>
            <Pressable onPress={() => removeRow(i)} disabled={rows.length === 1}>
              <Text className={rows.length === 1 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>Remove</Text>
            </Pressable>
          </View>
          <Field label="Compound">
            <CompoundPicker options={options} value={r.compound_id} onChange={(id) => update(i, { compound_id: id })} />
          </Field>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Week #">
                <Input value={String(r.week_number)} onChangeText={(v) => update(i, { week_number: Number(v) || 1 })} keyboardType="number-pad" />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Dose">
                <Input value={r.dose_value} onChangeText={(v) => update(i, { dose_value: v })} keyboardType="decimal-pad" placeholder="0" />
              </Field>
            </View>
          </View>
          <Field label="Unit">
            <Segmented options={UNIT_OPTS} value={r.dose_unit} onChange={(v) => update(i, { dose_unit: v })} />
          </Field>
          <Field label="Route">
            <Segmented options={ROUTE_OPTS} value={r.route} onChange={(v) => update(i, { route: v })} />
          </Field>
          <Field label="Frequency">
            <Input value={r.frequency} onChangeText={(v) => update(i, { frequency: v })} placeholder="weekly" />
          </Field>
        </Card>
      ))}
      <Button title="Add week" variant="outline" onPress={addRow} />
      <Button title="Save protocol" onPress={save} loading={saving} />
    </View>
  );
}

// ---------- Titration Schedules ----------
function TitrationTab({ schedules, onDeleted }: { schedules: Schedule[]; onDeleted: () => void }) {
  const { type } = useResponsive();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await apiFetch(`/api/protocols/${id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      Alert.alert("Could not delete", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeleting(null);
    }
  }

  if (schedules.length === 0) {
    return <EmptyState title="No titration schedules" hint="Build one in the Builder tab." />;
  }

  return (
    <View className="gap-4">
      {schedules.map((s) => {
        const byWeek = [...s.protocol_schedule_weeks].sort((a, b) => a.week_number - b.week_number);
        return (
          <Card key={s.id} className="gap-2">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="font-semibold text-foreground" style={{ fontSize: type.lg }}>{s.name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {s.phase ? `${s.phase} · ` : ""}
                  {byWeek.length} week{byWeek.length === 1 ? "" : "s"}
                  {s.start_on ? ` · starts ${s.start_on}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => remove(s.id)} disabled={deleting === s.id}>
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              </Pressable>
            </View>
            {byWeek.map((w) => (
              <View key={w.id} className="flex-row items-center justify-between border-t border-border pt-2">
                <Text className="w-10 text-sm tabular-nums text-muted-foreground">W{w.week_number}</Text>
                <Text className="flex-1 text-sm text-foreground">{w.compounds?.name ?? "—"}</Text>
                <Text className="text-sm text-muted-foreground">
                  {w.dose_value} {w.dose_unit} · {w.frequency}
                </Text>
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}
