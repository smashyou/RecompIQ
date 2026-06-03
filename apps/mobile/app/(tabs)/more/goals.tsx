import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GOAL_TAXONOMY, type EvidenceLevel } from "@peptide/shared";
import type { ContraindicationFinding } from "@peptide/peptides/contraindications";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Content } from "@/components/ui/Content";
import { Loading } from "@/components/ui/States";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { SafetyDisclaimer } from "@/components/ui/SafetyDisclaimer";
import { DoseText } from "@/components/peptides/DoseText";
import { ContraindicationBanner } from "@/components/peptides/ContraindicationBanner";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";

const prettify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface StackerResponse {
  plan: {
    summary: string;
    detected_goal_keys: string[];
    phasing_rationale: string;
    warnings: string[];
    phases: {
      name: string;
      goal_keys: string[];
      rationale: string;
      items: {
        slug: string;
        name: string;
        why: string;
        evidence_level: string;
        literature_dose_text: string | null;
        monitoring: string[];
        cautions: string[];
      }[];
    }[];
    clinician_points: string[];
  };
  contraindications: ContraindicationFinding[];
  model: string;
}

export default function Goals() {
  const { session } = useSession();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [freeText, setFreeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<StackerResponse | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const slugs = Array.from(new Set(GOAL_TAXONOMY.flatMap((g) => g.representativeSlugs)));
    const [{ data: goals }, { data: compounds }] = await Promise.all([
      supabase.from("user_goals").select("goal_key,priority").eq("user_id", uid).order("priority"),
      supabase.from("compounds").select("slug,name").in("slug", slugs),
    ]);
    setSelected((goals ?? []).map((g: any) => g.goal_key));
    const m: Record<string, string> = {};
    for (const c of (compounds ?? []) as any[]) m[c.slug] = c.name;
    setNames(m);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("user_goals").select("id,goal_key").eq("user_id", uid);
      const removed = (existing ?? []).filter((r: any) => !selected.includes(r.goal_key));
      if (removed.length) await supabase.from("user_goals").delete().in("id", removed.map((r: any) => r.id));
      if (selected.length)
        await supabase
          .from("user_goals")
          .upsert(
            selected.map((k, i) => ({ user_id: uid, goal_key: k, priority: i + 1, status: "active" })),
            { onConflict: "user_id,goal_key" },
          );
      Alert.alert("Saved", selected.length ? `${selected.length} goal(s) saved.` : "Goals cleared.");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (selected.length === 0 && !freeText.trim()) {
      Alert.alert("Pick a goal or describe what you want.");
      return;
    }
    setGenerating(true);
    setPlan(null);
    try {
      const res = await apiFetch<StackerResponse>("/api/stacker/generate", {
        method: "POST",
        body: JSON.stringify({ goal_keys: selected, free_text: freeText.trim() || null }),
      });
      setPlan(res);
    } catch (e) {
      Alert.alert("Could not generate a plan", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function applyPlan() {
    if (!plan) return;
    setApplying(true);
    try {
      const goalKeys = Array.from(new Set([...selected, ...plan.plan.detected_goal_keys])).filter((k) =>
        GOAL_TAXONOMY.some((g) => g.key === k),
      );
      await apiFetch("/api/stacker/apply", {
        method: "POST",
        body: JSON.stringify({ plan: plan.plan, goal_keys: goalKeys }),
      });
      Alert.alert("Plan applied", "Set your own doses next.");
      router.push("/(tabs)/peptides");
    } catch (e) {
      Alert.alert("Could not apply the plan", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Content className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Pick the outcomes you care about. Goals decide what we track and project, and guide the AI.
        Priority follows selection order. Compounds are an evidence-graded mapping, not advice.
      </Text>
      {GOAL_TAXONOMY.map((g) => {
        const on = selected.includes(g.key);
        const rank = selected.indexOf(g.key) + 1;
        return (
          <Pressable
            key={g.key}
            onPress={() => toggle(g.key)}
            style={{
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              borderColor: on ? colors.primary : colors.border,
              backgroundColor: on ? colors.surface2 : colors.card,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: "600", color: colors.foreground }}>{g.label}</Text>
                  {g.hasV1Projection ? (
                    <Text style={{ flexShrink: 0, fontSize: 9, fontWeight: "700", color: colors.fgSubtle }}>PROJECTED</Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: colors.fgSubtle, marginTop: 2 }}>{g.blurb}</Text>
              </View>
              <Ionicons
                name={on ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={on ? colors.primary : colors.border}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {g.representativeSlugs.slice(0, 4).map((slug) => (
                <Text
                  key={slug}
                  style={{
                    fontSize: 10.5,
                    color: colors.fgSubtle,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  {names[slug] ?? prettify(slug)}
                </Text>
              ))}
            </View>
            <Text style={{ fontSize: 10.5, color: colors.fgSubtle }}>
              Tracks: {g.signals.join(" · ")}
              {on && rank > 0 ? `  ·  priority ${rank}` : ""}
            </Text>
          </Pressable>
        );
      })}
      <Button title={saving ? "Saving…" : `Save goals (${selected.length})`} onPress={save} loading={saving} />

      {/* AI auto-stacker */}
      <Card style={{ gap: 12, marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          Ask the AI to assemble a plan
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.fgSubtle }}>
          Describe what you want in plain language (or just use your selected goals). The AI proposes
          an evidence-graded, phased plan — suggestions you accept and edit. It never prescribes.
        </Text>
        <Input
          value={freeText}
          onChangeText={setFreeText}
          placeholder="e.g. I want to drop ~40 lb, then put on muscle, and my skin + sleep could be better."
          multiline
          numberOfLines={4}
          style={{ height: 96, paddingTop: 10, textAlignVertical: "top" }}
        />
        <Button
          title={generating ? "Thinking…" : "Generate plan"}
          onPress={generate}
          loading={generating}
          left={<Ionicons name="sparkles-outline" size={16} color={colors.primaryForeground} />}
        />
      </Card>

      {/* review */}
      {plan ? (
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              color: colors.fgSubtle,
            }}
          >
            Proposed plan · review before applying
          </Text>

          <Card style={{ gap: 10 }}>
            <DoseText text={plan.plan.summary} className="text-sm leading-relaxed text-foreground" />
            {plan.plan.phasing_rationale ? (
              <DoseText
                text={plan.plan.phasing_rationale}
                className="text-xs leading-relaxed text-muted-foreground"
              />
            ) : null}
            <SafetyDisclaimer />
          </Card>

          {plan.plan.warnings.length ? (
            <View
              style={{
                gap: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.warnLine,
                backgroundColor: colors.warnWash,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                  color: colors.warn,
                }}
              >
                Heads up
              </Text>
              {plan.plan.warnings.map((w, i) => (
                <Text key={i} style={{ fontSize: 12, lineHeight: 17, color: colors.mutedForeground }}>
                  •  {w}
                </Text>
              ))}
            </View>
          ) : null}

          {plan.contraindications.length ? (
            <ContraindicationBanner findings={plan.contraindications} />
          ) : (
            <Text
              style={{
                fontSize: 12,
                lineHeight: 17,
                color: colors.mutedForeground,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              No contraindications found against your recorded conditions and medications. Not a
              substitute for clinician review.
            </Text>
          )}

          {plan.plan.phases.map((phase, pi) => (
            <Card key={pi} style={{ gap: 12 }}>
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                    color: colors.fgSubtle,
                  }}
                >
                  Phase {pi + 1}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {phase.name}
                </Text>
                {phase.rationale ? (
                  <DoseText
                    text={phase.rationale}
                    className="text-xs leading-relaxed text-muted-foreground"
                  />
                ) : null}
              </View>
              {phase.items.map((it, ii) => (
                <View
                  key={ii}
                  style={{
                    gap: 4,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 10,
                  }}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      {it.name}
                    </Text>
                    <EvidenceBadge level={it.evidence_level as EvidenceLevel} />
                  </View>
                  <DoseText text={it.why} className="text-xs leading-relaxed text-muted-foreground" />
                  {it.literature_dose_text ? (
                    <DoseText
                      text={it.literature_dose_text}
                      className="text-xs leading-relaxed text-foreground"
                    />
                  ) : null}
                  {it.cautions.length ? (
                    <Text style={{ fontSize: 11, color: colors.warn }}>
                      Caution: {it.cautions.join(" · ")}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ))}

          {plan.plan.clinician_points.length ? (
            <Card style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                Discuss with your clinician
              </Text>
              {plan.plan.clinician_points.map((c, i) => (
                <Text key={i} style={{ fontSize: 12, lineHeight: 17, color: colors.mutedForeground }}>
                  •  {c}
                </Text>
              ))}
            </Card>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title={applying ? "Applying…" : "Apply to my regimen"}
              onPress={applyPlan}
              loading={applying}
              className="flex-1"
            />
            <Button title="Discard" variant="outline" onPress={() => setPlan(null)} />
          </View>
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.fgSubtle }}>
            Applying adds these as AI-suggested items with no dose set — you (or your clinician)
            decide the dose. Educational only, not a prescription.
          </Text>
        </View>
      ) : null}
    </Content>
  );
}
