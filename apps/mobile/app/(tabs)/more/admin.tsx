import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { StatBox } from "@/components/ui/StatBox";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

// ---------- types (mirror /api/admin/* response shapes) ----------
interface ProviderJoin {
  slug: string;
  kind: string;
  env_key_var: string;
}
interface ModelRow {
  id: string;
  model_id: string;
  display_name: string;
  modality: "chat" | "vision" | "embedding";
  context_window: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  notes: string | null;
  ai_providers: ProviderJoin;
}
interface Provider {
  id: string;
  slug: string;
  name: string;
  kind: string;
  env_key_var: string;
  notes: string | null;
}
interface FeatureConfig {
  feature: string;
  primary_model_id: string;
  fallback_ids: string[];
}
interface UsageData {
  days: number;
  total_calls: number;
  total_cost_usd: number;
  by_feature: { feature: string; calls: number; cost_usd: number; errors: number; fallbacks: number }[];
  by_model: {
    provider_slug: string;
    model_string: string;
    calls: number;
    cost_usd: number;
    avg_latency_ms: number;
  }[];
  recent: unknown[];
}
interface TestResult {
  ok: boolean;
  error?: string;
  latency_ms?: number;
  model?: string;
  provider?: string;
  text?: string;
  input_tokens?: number;
  output_tokens?: number;
  dims?: number;
}

const FEATURE_INFO: Record<string, { label: string; description: string; modality: "chat" | "embedding" }> = {
  coach: { label: "Coach", description: "Streaming chat with user.", modality: "chat" },
  vision: { label: "Vision", description: "Photo food / body / lab parsing.", modality: "chat" },
  embeddings: { label: "Embeddings", description: "RAG over peptide knowledge base.", modality: "embedding" },
  insights: { label: "Daily insights", description: "Cron-generated dashboard cards.", modality: "chat" },
  stacker: { label: "Stacker", description: "AI peptide framework reasoning.", modality: "chat" },
  transcribe: { label: "Transcription", description: "Future voice input.", modality: "chat" },
};

const TABS = [
  { value: "features", label: "Feature config" },
  { value: "catalog", label: "Catalog" },
  { value: "usage", label: "Usage" },
] as const;

export default function Admin() {
  const { session } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<string>("features");

  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [config, setConfig] = useState<FeatureConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin guard — verify profiles.is_admin (the demo user is admin).
  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data?.is_admin)));
  }, [session?.user.id]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [modelsRes, featuresRes] = await Promise.all([
        apiFetch<{ providers: Provider[]; models: ModelRow[] }>("/api/admin/models"),
        apiFetch<FeatureConfig[]>("/api/admin/features"),
      ]);
      setProviders(modelsRes.providers ?? []);
      setModels(modelsRes.models ?? []);
      setConfig(featuresRes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (isAdmin === false) {
    return (
      <Content>
        <EmptyState title="Admin only" hint="You don't have admin access." />
      </Content>
    );
  }
  if (isAdmin === null || loading) return <Loading />;

  return (
    <Content className="gap-4">
      <Text className="text-xs leading-snug text-muted-foreground">
        AI provider configuration, model selection per feature, and usage monitoring.
      </Text>

      <Segmented options={TABS} value={tab} onChange={setTab} fill />

      {error ? <ErrorState message={error} /> : null}

      {tab === "features" ? (
        <FeaturesTab models={models} config={config} onSaved={load} />
      ) : tab === "catalog" ? (
        <CatalogTab providers={providers} models={models} />
      ) : (
        <UsageTab />
      )}
    </Content>
  );
}

// ---------- Feature config ----------
function FeaturesTab({
  models,
  config,
  onSaved,
}: {
  models: ModelRow[];
  config: FeatureConfig[];
  onSaved: () => void;
}) {
  const [configState, setConfigState] = useState<FeatureConfig[]>(config);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const modelsByModality = useMemo(() => {
    const map = new Map<string, ModelRow[]>();
    for (const m of models) {
      const arr = map.get(m.modality) ?? [];
      arr.push(m);
      map.set(m.modality, arr);
    }
    return map;
  }, [models]);

  function modelsForFeature(feature: string) {
    const modality = FEATURE_INFO[feature]?.modality ?? "chat";
    if (feature === "vision") return modelsByModality.get("vision") ?? [];
    if (modality === "embedding") return modelsByModality.get("embedding") ?? [];
    return [...(modelsByModality.get("chat") ?? []), ...(modelsByModality.get("vision") ?? [])];
  }

  function patchFeature(feature: string, patch: Partial<FeatureConfig>) {
    setConfigState((prev) => {
      const exists = prev.some((c) => c.feature === feature);
      if (exists) return prev.map((c) => (c.feature === feature ? { ...c, ...patch } : c));
      return [...prev, { feature, primary_model_id: "", fallback_ids: [], ...patch }];
    });
  }

  async function saveFeature(feature: string, primary: string, fallbacks: string[]) {
    setSavingFeature(feature);
    try {
      await apiFetch("/api/admin/features", {
        method: "PATCH",
        body: JSON.stringify({ feature, primary_model_id: primary, fallback_ids: fallbacks }),
      });
      Alert.alert("Saved", `${FEATURE_INFO[feature]?.label ?? feature} updated.`);
      onSaved();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSavingFeature(null);
    }
  }

  async function testModel(modelId: string) {
    setTesting(modelId);
    try {
      const d = await apiFetch<TestResult>("/api/admin/test-model", {
        method: "POST",
        body: JSON.stringify({ model_id: modelId }),
      });
      if (d.ok) {
        const summary =
          d.dims != null
            ? `${d.dims} dims · ${d.latency_ms}ms`
            : `${d.latency_ms}ms · "${(d.text ?? "").slice(0, 40)}"`;
        setTestResults((prev) => ({ ...prev, [modelId]: { ok: true, msg: summary } }));
        Alert.alert("Test passed", `ok · ${summary}`);
      } else {
        const msg = d.error ?? "test failed";
        setTestResults((prev) => ({ ...prev, [modelId]: { ok: false, msg } }));
        Alert.alert("Test failed", msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "test failed";
      setTestResults((prev) => ({ ...prev, [modelId]: { ok: false, msg } }));
      Alert.alert("Test failed", msg);
    } finally {
      setTesting(null);
    }
  }

  return (
    <View className="gap-4">
      {Object.entries(FEATURE_INFO).map(([feature, info]) => {
        const cfg = configState.find((c) => c.feature === feature);
        const available = modelsForFeature(feature);
        const primary = cfg?.primary_model_id ?? available[0]?.id ?? "";
        const fallbacks = cfg?.fallback_ids ?? [];
        const primaryResult = testResults[primary];

        return (
          <Card key={feature} className="gap-3">
            <View>
              <Text className="text-sm font-semibold text-foreground">{info.label}</Text>
              <Text className="text-xs text-muted-foreground">{info.description}</Text>
            </View>

            <View className="gap-1.5">
              <Text className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Primary model
              </Text>
              <ModelPicker
                options={available}
                value={primary}
                onChange={(id) => patchFeature(feature, { primary_model_id: id })}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Fallback chain ({fallbacks.length})
              </Text>
              {fallbacks.map((fbId, idx) => (
                <View key={`${fbId}-${idx}`} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <ModelPicker
                      options={available}
                      value={fbId}
                      onChange={(id) => {
                        const next = [...fallbacks];
                        next[idx] = id;
                        patchFeature(feature, { fallback_ids: next });
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => testModel(fbId)}
                    disabled={testing === fbId}
                    className="rounded-md border border-border p-2 active:bg-muted"
                    accessibilityLabel="Test fallback model"
                  >
                    <Ionicons
                      name={
                        testResults[fbId]?.ok
                          ? "checkmark-circle"
                          : testResults[fbId]
                            ? "close-circle"
                            : "pulse"
                      }
                      size={16}
                      color={
                        testResults[fbId]?.ok
                          ? colors.accent
                          : testResults[fbId]
                            ? colors.destructive
                            : colors.mutedForeground
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => patchFeature(feature, { fallback_ids: fallbacks.filter((_, i) => i !== idx) })}
                    className="rounded-md border border-border p-2 active:bg-muted"
                    accessibilityLabel="Remove fallback"
                  >
                    <Ionicons name="close" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => {
                  const next = available.find((m) => m.id !== primary && !fallbacks.includes(m.id));
                  if (!next) return;
                  patchFeature(feature, { fallback_ids: [...fallbacks, next.id] });
                }}
                className="self-start rounded-md border border-dashed border-border px-3 py-1.5 active:bg-muted"
              >
                <Text className="text-xs text-muted-foreground">+ Add fallback</Text>
              </Pressable>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  title={testing === primary ? "Testing…" : "Test primary"}
                  variant="outline"
                  loading={testing === primary}
                  disabled={!primary || testing === primary}
                  onPress={() => testModel(primary)}
                />
              </View>
              <View className="flex-1">
                <Button
                  title={savingFeature === feature ? "Saving…" : "Save"}
                  loading={savingFeature === feature}
                  disabled={!primary || savingFeature === feature}
                  onPress={() => saveFeature(feature, primary, fallbacks)}
                />
              </View>
            </View>

            {primaryResult ? (
              <Text className={primaryResult.ok ? "text-xs text-accent" : "text-xs text-destructive"}>
                {primaryResult.msg}
              </Text>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

// Modal selector — RN stand-in for the web <select> of models.
function ModelPicker({
  options,
  value,
  onChange,
}: {
  options: ModelRow[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-border bg-input px-3 py-2.5"
      >
        <Text
          className={selected ? "flex-1 text-sm text-foreground" : "flex-1 text-sm text-muted-foreground"}
          numberOfLines={1}
        >
          {selected ? `${selected.display_name} — ${selected.ai_providers.slug}` : "Choose a model"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-2xl border-t border-border bg-card p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">Select model</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            {options.length === 0 ? (
              <Text className="py-6 text-center text-sm text-muted-foreground">No models available.</Text>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(o) => o.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between border-b border-border py-3"
                  >
                    <View className="flex-1">
                      <Text className="text-sm text-foreground">{item.display_name}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {item.ai_providers.slug} · {item.modality}
                      </Text>
                    </View>
                    {item.id === value ? (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ---------- Model catalog ----------
function CatalogTab({ providers, models }: { providers: Provider[]; models: ModelRow[] }) {
  if (providers.length === 0) {
    return <EmptyState title="No providers" hint="No active AI providers configured." />;
  }
  return (
    <View className="gap-4">
      {providers.map((p) => {
        const providerModels = models.filter((m) => m.ai_providers.slug === p.slug);
        return (
          <Card key={p.id} className="gap-3">
            <View className="gap-1.5">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-sm font-semibold text-foreground">{p.name}</Text>
                <Pill label={p.kind} />
                <Pill label={`env: ${p.env_key_var}`} />
              </View>
              {p.notes ? <Text className="text-xs text-muted-foreground">{p.notes}</Text> : null}
            </View>

            {providerModels.length === 0 ? (
              <Text className="text-xs text-muted-foreground">No active models.</Text>
            ) : (
              <View className="gap-2">
                {providerModels.map((m) => (
                  <View key={m.id} className="gap-1 border-t border-border pt-2">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm text-foreground">{m.display_name}</Text>
                      <Pill label={m.modality} />
                    </View>
                    <View className="flex-row flex-wrap gap-x-4 gap-y-0.5">
                      <Text className="text-xs tabular-nums text-muted-foreground">
                        ctx: {m.context_window ? m.context_window.toLocaleString() : "—"}
                      </Text>
                      <Text className="text-xs tabular-nums text-muted-foreground">
                        in: {m.input_cost_per_1m !== null ? `$${m.input_cost_per_1m}/1M` : "—"}
                      </Text>
                      <Text className="text-xs tabular-nums text-muted-foreground">
                        out: {m.output_cost_per_1m !== null ? `$${m.output_cost_per_1m}/1M` : "—"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

// ---------- Usage ----------
function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<UsageData>("/api/admin/usage?days=7");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }

  const totalErrors = data?.by_feature.reduce((a, b) => a + b.errors, 0) ?? 0;
  const totalFallbacks = data?.by_feature.reduce((a, b) => a + b.fallbacks, 0) ?? 0;

  return (
    <View className="gap-4">
      <Button
        title={loading ? "Loading…" : data ? "Refresh" : "Load 7-day usage"}
        variant="outline"
        loading={loading}
        disabled={loading}
        onPress={load}
      />

      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <StatBox label="Calls (7d)" value={data.total_calls.toLocaleString()} />
            <StatBox label="Cost (7d)" value={`$${data.total_cost_usd.toFixed(4)}`} />
            <StatBox label="Errors / Fallbacks" value={`${totalErrors} / ${totalFallbacks}`} />
          </View>

          <Card className="gap-2">
            <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">By feature</Text>
            <View className="flex-row gap-2 border-b border-border pb-1">
              <Text className="flex-1 text-[10px] uppercase text-muted-foreground">Feature</Text>
              <Text className="w-12 text-right text-[10px] uppercase text-muted-foreground">Calls</Text>
              <Text className="w-16 text-right text-[10px] uppercase text-muted-foreground">Cost</Text>
              <Text className="w-8 text-right text-[10px] uppercase text-muted-foreground">Err</Text>
              <Text className="w-8 text-right text-[10px] uppercase text-muted-foreground">FB</Text>
            </View>
            {data.by_feature.length === 0 ? (
              <Text className="py-2 text-xs text-muted-foreground">No calls in range.</Text>
            ) : (
              data.by_feature.map((r) => (
                <View key={r.feature} className="flex-row gap-2 border-b border-border py-1.5">
                  <Text className="flex-1 text-xs text-foreground">{r.feature}</Text>
                  <Text className="w-12 text-right text-xs tabular-nums text-muted-foreground">{r.calls}</Text>
                  <Text className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                    ${r.cost_usd.toFixed(4)}
                  </Text>
                  <Text className="w-8 text-right text-xs tabular-nums text-muted-foreground">{r.errors}</Text>
                  <Text className="w-8 text-right text-xs tabular-nums text-muted-foreground">{r.fallbacks}</Text>
                </View>
              ))
            )}
          </Card>

          <Card className="gap-2">
            <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">By model</Text>
            <View className="flex-row gap-2 border-b border-border pb-1">
              <Text className="flex-1 text-[10px] uppercase text-muted-foreground">Model</Text>
              <Text className="w-12 text-right text-[10px] uppercase text-muted-foreground">Calls</Text>
              <Text className="w-16 text-right text-[10px] uppercase text-muted-foreground">Cost</Text>
              <Text className="w-14 text-right text-[10px] uppercase text-muted-foreground">Avg ms</Text>
            </View>
            {data.by_model.length === 0 ? (
              <Text className="py-2 text-xs text-muted-foreground">No calls in range.</Text>
            ) : (
              data.by_model.map((r) => (
                <View key={`${r.provider_slug}/${r.model_string}`} className="flex-row gap-2 border-b border-border py-1.5">
                  <Text className="flex-1 text-[11px] text-foreground" numberOfLines={1}>
                    {r.provider_slug}/{r.model_string}
                  </Text>
                  <Text className="w-12 text-right text-xs tabular-nums text-muted-foreground">{r.calls}</Text>
                  <Text className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                    ${r.cost_usd.toFixed(4)}
                  </Text>
                  <Text className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                    {r.avg_latency_ms}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </View>
  );
}
