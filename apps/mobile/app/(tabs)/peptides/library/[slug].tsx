import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EvidenceLevel } from "@peptide/shared";
import { Card } from "@/components/ui/Card";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { Pill } from "@/components/ui/Pill";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { Segmented } from "@/components/ui/Segmented";
import { Loading, ErrorState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { usePeptideSelection } from "@/lib/peptide-selection";
import { colors, radius } from "@/lib/theme";

interface Citation { source?: string; title?: string; url?: string; year?: number }
interface Compound {
  id: string; slug: string; name: string; category: string;
  evidence_level: EvidenceLevel; fda_approved: boolean;
  short_description: string; mechanism: string | null; typical_route: string | null;
  is_blend: boolean; component_mg: { label: string; mg: number | null }[]; typical_vial_mg: number | null;
  monitoring_notes: string[]; absolute_contraindications: string[]; relative_contraindications: string[];
  common_side_effects: string[]; serious_adverse_events: string[]; citations: Citation[];
}
interface DoseRef {
  id: string; context: string; route: string | null; low_value: number | null; high_value: number | null;
  unit: string; frequency: string | null; evidence_level: EvidenceLevel; is_human_data: boolean; notes: string | null;
}
interface Synergy {
  id: string; paired_name: string; rationale: string; evidence_level: EvidenceLevel; is_human_data: boolean; caution_notes: string | null;
}

function rangeText(r: DoseRef): string {
  const u = r.unit;
  let core: string;
  if (r.low_value != null && r.high_value != null) core = r.low_value === r.high_value ? `${r.low_value} ${u}` : `${r.low_value}–${r.high_value} ${u}`;
  else if (r.low_value != null) core = `from ${r.low_value} ${u}`;
  else if (r.high_value != null) core = `up to ${r.high_value} ${u}`;
  else core = "no established range";
  return r.frequency ? `${core}, ${r.frequency}` : core;
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "dosing", label: "Dosing" },
  { value: "research", label: "Research" },
  { value: "faq", label: "FAQ" },
];

export default function CompoundDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const sel = usePeptideSelection();
  const [compound, setCompound] = useState<Compound | null>(null);
  const [doses, setDoses] = useState<DoseRef[]>([]);
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      const { data: c, error: cErr } = await supabase.from("compounds").select("*").eq("slug", slug).maybeSingle();
      if (!active) return;
      if (cErr || !c) { setError(cErr?.message ?? "Compound not found"); setLoading(false); return; }
      setCompound(c as Compound);
      sel.setSlug((c as Compound).slug);
      const [{ data: d }, { data: s }] = await Promise.all([
        supabase.from("compound_dose_reference").select("id, context, route, low_value, high_value, unit, frequency, evidence_level, is_human_data, notes").eq("compound_id", (c as Compound).id),
        supabase.from("compound_synergies").select("id, paired_name, rationale, evidence_level, is_human_data, caution_notes").eq("compound_id", (c as Compound).id).order("paired_name"),
      ]);
      if (!active) return;
      setDoses((d ?? []) as DoseRef[]);
      setSynergies((s ?? []) as Synergy[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  if (loading) return <Loading />;
  if (error || !compound) return <View className="flex-1 bg-background p-4"><ErrorState message={error ?? "Not found"} /></View>;

  return (
    <>
      <Stack.Screen options={{ title: compound.name }} />
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 gap-4 pb-12">
        {/* Header — matches handoff MCompound: flask glyph + display name + evidence badge */}
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center"
            style={{ width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 }}
          >
            <Ionicons name="flask-outline" size={24} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground" style={{ letterSpacing: -0.4 }}>{compound.name}</Text>
            <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
              <EvidenceBadge level={compound.evidence_level} />
              {compound.fda_approved ? <Pill label="FDA" tone="accent" /> : null}
            </View>
          </View>
        </View>

        {/* Clinician-discuss banner (handoff MCompound primary-wash callout) */}
        <View
          className="flex-row items-center"
          style={{ gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primaryLine, backgroundColor: colors.primaryWash }}
        >
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
          <Text className="flex-1 text-sm text-foreground">Discuss with your clinician before starting or changing.</Text>
        </View>

        <Text className="text-xs uppercase tracking-wider text-muted-foreground">
          {compound.category.replace("_", " ")}{compound.typical_route ? ` · ${compound.typical_route}` : ""}
        </Text>
        <Text className="text-base leading-relaxed text-muted-foreground">{compound.short_description}</Text>

        <Segmented options={TABS} value={tab} onChange={setTab} fill />

        {tab === "overview" ? <Overview compound={compound} synergies={synergies} />
          : tab === "dosing" ? <Dosing compound={compound} doses={doses} onCalc={() => { sel.setSlug(compound.slug); }} />
          : tab === "research" ? <Research citations={(compound.citations ?? []).filter((c) => c.title || c.url || c.source)} />
          : <Faq compound={compound} synergies={synergies} />}

        <SafetyDisclaimer />
      </ScrollView>
    </>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2">
      {title ? <Text className="text-sm font-semibold text-foreground">{title}</Text> : null}
      {children}
    </Card>
  );
}

function Overview({ compound, synergies }: { compound: Compound; synergies: Synergy[] }) {
  return (
    <View className="gap-3">
      {compound.is_blend ? (
        <View className="gap-1 rounded-xl border border-accent bg-card p-4">
          <Text className="text-sm font-medium text-foreground">This is a multi-peptide blend</Text>
          <Text className="text-xs leading-snug text-muted-foreground">
            Blends are community/vendor combinations, not single compounds, and are not FDA-approved. There is no
            established human dose for the combined product — sourcing and purity of unregulated blends are unverified.
          </Text>
          {compound.component_mg?.length > 0 ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              Composition: <Text className="text-foreground">{compound.component_mg.map((c) => `${c.label}${c.mg != null ? ` ${c.mg} mg` : ""}`).join(" / ")}</Text>
              {compound.typical_vial_mg ? ` · ${compound.typical_vial_mg} mg total` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      {compound.mechanism ? (
        <SectionCard title="Mechanism of action">
          <Text className="text-sm leading-relaxed text-muted-foreground">{compound.mechanism}</Text>
        </SectionCard>
      ) : null}

      {synergies.length > 0 ? (
        <SectionCard title="Commonly Stacked With">
          <Text className="text-xs text-muted-foreground">
            Educational pharmacologic rationale only — not a recommended protocol. Review any combination with a clinician
            and against your contraindications.
          </Text>
          {synergies.map((s) => (
            <View key={s.id} className="mt-2 gap-1 rounded-lg border border-border p-3">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <Ionicons name="link-outline" size={14} color={colors.mutedForeground} />
                  <Text className="flex-1 text-sm font-medium text-foreground">{s.paired_name}</Text>
                </View>
                <EvidenceBadge level={s.evidence_level} />
              </View>
              <Text className="text-xs leading-snug text-muted-foreground">{s.rationale}</Text>
              {s.caution_notes ? <Text className="text-xs text-destructive">Caution: {s.caution_notes}</Text> : null}
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Cautions compound={compound} />
    </View>
  );
}

function Cautions({ compound }: { compound: Compound }) {
  const has = compound.absolute_contraindications.length || compound.relative_contraindications.length || compound.serious_adverse_events.length || compound.monitoring_notes.length;
  if (!has) return null;
  return (
    <SectionCard title="Safety & monitoring">
      <Block label="Do not use if" items={compound.absolute_contraindications} tone="destructive" />
      <Block label="Use caution if" items={compound.relative_contraindications} tone="accent" />
      <Block label="Serious adverse events" items={compound.serious_adverse_events} tone="accent" />
      <Block label="Monitoring" items={compound.monitoring_notes} tone="muted" />
    </SectionCard>
  );
}
function Block({ label, items, tone }: { label: string; items: string[]; tone: "destructive" | "accent" | "muted" }) {
  if (!items?.length) return null;
  const color = tone === "destructive" ? "text-destructive" : tone === "accent" ? "text-accent" : "text-muted-foreground";
  return (
    <View className="mt-2 gap-1">
      <Text className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</Text>
      {items.map((x, i) => (
        <View key={i} className="flex-row gap-2"><Text className="text-muted-foreground">•</Text><Text className="flex-1 text-sm leading-snug text-muted-foreground">{x}</Text></View>
      ))}
    </View>
  );
}

function Dosing({ compound, doses, onCalc }: { compound: Compound; doses: DoseRef[]; onCalc: () => void }) {
  const router = useRouter();
  return (
    <View className="gap-3">
      {compound.is_blend ? (
        <View className="rounded-lg border border-accent bg-card p-3">
          <Text className="text-xs leading-snug text-muted-foreground">
            A blend is drawn as a single volume from the mixed vial, so the "dose" depends on how it was mixed. There is no
            validated combined-product dose — the per-component ranges (each component's own page) are educational only.
          </Text>
        </View>
      ) : null}

      {doses.length > 0 ? (
        <SectionCard title="Dosing protocols (literature reference)">
          {doses.map((d, i) => (
            <View key={d.id} className={i === 0 ? "gap-1" : "gap-1 border-t border-border pt-3"}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm font-medium capitalize text-foreground">{d.context}</Text>
                <View className="flex-row items-center gap-1">
                  <EvidenceBadge level={d.evidence_level} />
                  {!d.is_human_data ? <Pill label="non-human" /> : null}
                </View>
              </View>
              <Text className="text-base text-primary">{rangeText(d)}</Text>
              {d.route ? <Text className="text-xs uppercase text-muted-foreground">route: {d.route}</Text> : null}
              {d.notes ? <Text className="text-xs text-muted-foreground">{d.notes}</Text> : null}
            </View>
          ))}
          <Text className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Educational and research summary only — not a prescription.</Text>
        </SectionCard>
      ) : (
        <SectionCard>
          <Text className="text-sm text-muted-foreground">No established literature dose ranges. Use values from you or your clinician in the calculator.</Text>
        </SectionCard>
      )}

      {compound.common_side_effects.length > 0 ? (
        <SectionCard title="Potential side effects">
          {compound.common_side_effects.map((s, i) => (
            <View key={i} className="flex-row gap-2"><Text className="text-accent">•</Text><Text className="flex-1 text-sm text-muted-foreground">{s}</Text></View>
          ))}
        </SectionCard>
      ) : null}

      <Pressable
        onPress={() => { onCalc(); router.push({ pathname: "/(tabs)/peptides/reconstitution", params: { compound: compound.slug } }); }}
        className="flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-80"
      >
        <Ionicons name="flask-outline" size={18} color={colors.primaryForeground} />
        <Text className="text-base font-semibold text-primary-foreground">Open in reconstitution calculator</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/(tabs)/peptides/protocols?tab=reference")} className="flex-row items-center justify-center rounded-xl border border-border px-4 py-3 active:opacity-70">
        <Text className="text-base font-medium text-foreground">Reference, builder & schedules →</Text>
      </Pressable>
    </View>
  );
}

function Research({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return <SectionCard><Text className="text-sm text-muted-foreground">No catalogued references for this compound yet.</Text></SectionCard>;
  return (
    <View className="gap-3">
      <View className="rounded-lg border border-border bg-muted p-3">
        <Text className="text-xs leading-snug text-muted-foreground">References from public sources (PubMed, FDA, ClinicalTrials.gov, journals). Informational only — not medical advice.</Text>
      </View>
      {citations.map((c, i) => (
        <Card key={i} className="flex-row gap-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-primary"><Text className="text-xs font-semibold text-primary-foreground">{i + 1}</Text></View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-foreground">{c.title ?? c.source ?? "Reference"}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">{[c.source, c.year].filter(Boolean).join(" · ")}</Text>
            {c.url ? <Pressable onPress={() => Linking.openURL(c.url!)}><Text className="mt-1 text-xs text-primary">View source ↗</Text></Pressable> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

function Faq({ compound, synergies }: { compound: Compound; synergies: Synergy[] }) {
  const faqs: { q: string; a: string }[] = [];
  faqs.push({
    q: `Is ${compound.name} FDA-approved?`,
    a: compound.fda_approved
      ? `${compound.name} has at least one FDA-approved indication. Approval is specific to the labeled use, dose, and route — uses outside that label are off-label.`
      : `No. ${compound.name} is not FDA-approved. It is used in research and/or off-label contexts; quality, dosing, and safety of unregulated sources are unverified.`,
  });
  faqs.push({
    q: "How strong is the evidence?",
    a: `Top-level evidence grade: ${compound.evidence_level.replace(/_/g, " ").toLowerCase()}. Each dose range in the Dosing tab carries its own grade and citation. Animal- or mechanism-only data does not establish human dosing.`,
  });
  if (compound.absolute_contraindications.length || compound.relative_contraindications.length) {
    faqs.push({
      q: "What are the main safety cautions?",
      a: [
        compound.absolute_contraindications.length ? `Absolute: ${compound.absolute_contraindications.join("; ")}.` : "",
        compound.relative_contraindications.length ? `Relative: ${compound.relative_contraindications.join("; ")}.` : "",
      ].filter(Boolean).join(" "),
    });
  }
  if (synergies.length) {
    faqs.push({
      q: "What is it commonly stacked with?",
      a: `Educationally discussed combinations: ${synergies.map((s) => s.paired_name).join(", ")}. These are pharmacologic rationale only, not recommended protocols — see the Overview tab.`,
    });
  }
  return <View className="gap-2">{faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</View>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-xl border border-border bg-card">
      <Pressable onPress={() => setOpen((o) => !o)} className="flex-row items-center justify-between gap-3 p-4">
        <Text className="flex-1 text-sm font-medium text-foreground">{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open ? <Text className="border-t border-border p-4 text-sm leading-relaxed text-muted-foreground">{a}</Text> : null}
    </View>
  );
}
