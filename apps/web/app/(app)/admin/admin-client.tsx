"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";

interface Provider {
  id: string;
  slug: string;
  name: string;
  kind: string;
  env_key_var: string;
  notes: string | null;
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
  ai_providers: { slug: string; name: string; kind: string };
}

interface FeatureConfig {
  feature: string;
  primary_model_id: string;
  fallback_ids: string[];
}

const FEATURE_INFO: Record<string, { label: string; description: string; modality: "chat" | "embedding" }> = {
  coach: { label: "Coach", description: "Streaming chat with user.", modality: "chat" },
  vision: { label: "Vision", description: "Photo food / body / lab parsing.", modality: "chat" },
  embeddings: { label: "Embeddings", description: "RAG over peptide knowledge base.", modality: "embedding" },
  insights: { label: "Daily insights", description: "Cron-generated dashboard cards.", modality: "chat" },
  stacker: { label: "Stacker", description: "AI peptide framework reasoning.", modality: "chat" },
  transcribe: { label: "Transcription", description: "Future voice input.", modality: "chat" },
};

export function AdminClient({
  providers,
  models,
  config,
}: {
  providers: Provider[];
  models: ModelRow[];
  config: FeatureConfig[];
}) {
  const router = useRouter();
  const toast = useFireToast();
  const [section, setSection] = useState<"features" | "catalog" | "usage">("features");
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
    // Vision feature draws from vision-tagged models specifically;
    // other chat-modality features can use either chat or vision (vision is a superset).
    if (feature === "vision") return modelsByModality.get("vision") ?? [];
    if (modality === "embedding") return modelsByModality.get("embedding") ?? [];
    return [...(modelsByModality.get("chat") ?? []), ...(modelsByModality.get("vision") ?? [])];
  }

  async function saveFeature(feature: string, primary: string, fallbacks: string[]) {
    setSavingFeature(feature);
    const res = await fetch("/api/admin/features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, primary_model_id: primary, fallback_ids: fallbacks }),
    });
    setSavingFeature(null);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Save failed");
      return;
    }
    toast.success(`${FEATURE_INFO[feature]?.label ?? feature} updated`);
    router.refresh();
  }

  async function testModel(modelId: string) {
    setTesting(modelId);
    const res = await fetch("/api/admin/test-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    });
    setTesting(null);
    const body = (await res.json()) as {
      data?: { ok: boolean; latency_ms?: number; text?: string; error?: string; dims?: number };
    };
    const d = body.data;
    if (d?.ok) {
      const summary = d.dims
        ? `${d.dims} dims · ${d.latency_ms}ms`
        : `${d.latency_ms}ms · "${(d.text ?? "").slice(0, 40)}"`;
      setTestResults((prev) => ({ ...prev, [modelId]: { ok: true, msg: summary } }));
      toast.success(`ok · ${summary}`);
    } else {
      setTestResults((prev) => ({
        ...prev,
        [modelId]: { ok: false, msg: d?.error ?? "test failed" },
      }));
      toast.error(d?.error ?? "test failed");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          AI provider configuration, model selection per feature, and usage monitoring.
        </p>
      </header>

      <nav className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        <TabButton active={section === "features"} onClick={() => setSection("features")}>
          Feature config
        </TabButton>
        <TabButton active={section === "catalog"} onClick={() => setSection("catalog")}>
          Model catalog
        </TabButton>
        <TabButton active={section === "usage"} onClick={() => setSection("usage")}>
          Usage
        </TabButton>
      </nav>

      {section === "features" && (
        <section className="space-y-4">
          {Object.entries(FEATURE_INFO).map(([feature, info]) => {
            const cfg = configState.find((c) => c.feature === feature);
            const available = modelsForFeature(feature);
            const primary = cfg?.primary_model_id ?? available[0]?.id ?? "";
            const fallbacks = cfg?.fallback_ids ?? [];
            return (
              <div
                key={feature}
                className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{info.label}</h2>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {info.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Primary model
                  </label>
                  <select
                    value={primary}
                    onChange={(e) => {
                      const newPrimary = e.target.value;
                      setConfigState((prev) =>
                        prev.map((c) =>
                          c.feature === feature ? { ...c, primary_model_id: newPrimary } : c,
                        ),
                      );
                    }}
                    className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
                  >
                    {available.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} — {m.ai_providers.slug}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Fallback chain ({fallbacks.length})
                  </label>
                  {fallbacks.map((fbId, idx) => {
                    const fbModel = available.find((m) => m.id === fbId);
                    return (
                      <div key={`${fbId}-${idx}`} className="flex gap-2">
                        <select
                          value={fbId}
                          onChange={(e) => {
                            const newFbs = [...fallbacks];
                            newFbs[idx] = e.target.value;
                            setConfigState((prev) =>
                              prev.map((c) =>
                                c.feature === feature ? { ...c, fallback_ids: newFbs } : c,
                              ),
                            );
                          }}
                          className="flex h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
                        >
                          {available.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newFbs = fallbacks.filter((_, i) => i !== idx);
                            setConfigState((prev) =>
                              prev.map((c) =>
                                c.feature === feature ? { ...c, fallback_ids: newFbs } : c,
                              ),
                            );
                          }}
                          className="rounded-md border border-[var(--color-border)] px-2 text-xs"
                        >
                          ✕
                        </button>
                        {fbModel && (
                          <button
                            type="button"
                            onClick={() => testModel(fbId)}
                            disabled={testing === fbId}
                            className="rounded-md border border-[var(--color-border)] px-2 text-xs"
                            title="Test connection"
                          >
                            {testing === fbId ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : testResults[fbId]?.ok ? (
                              <CheckCircle2 className="h-3 w-3 text-[var(--color-accent)]" />
                            ) : testResults[fbId] ? (
                              <XCircle className="h-3 w-3 text-[var(--color-destructive)]" />
                            ) : (
                              <Activity className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const next = available.find((m) => m.id !== primary && !fallbacks.includes(m.id));
                      if (!next) return;
                      const newFbs = [...fallbacks, next.id];
                      setConfigState((prev) =>
                        prev.map((c) =>
                          c.feature === feature ? { ...c, fallback_ids: newFbs } : c,
                        ),
                      );
                    }}
                    className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-1 text-xs"
                  >
                    + Add fallback
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => testModel(primary)}
                    disabled={!primary || testing === primary}
                    variant="outline"
                  >
                    {testing === primary ? "Testing…" : "Test primary"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveFeature(feature, primary, fallbacks)}
                    disabled={!primary || savingFeature === feature}
                  >
                    {savingFeature === feature ? "Saving…" : "Save"}
                  </Button>
                </div>
                {testResults[primary] && (
                  <p
                    className={`text-xs ${
                      testResults[primary]!.ok
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-destructive)]"
                    }`}
                  >
                    {testResults[primary]!.msg}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {section === "catalog" && (
        <section className="space-y-4">
          {providers.map((p) => {
            const providerModels = models.filter((m) => m.ai_providers.slug === p.slug);
            return (
              <div
                key={p.id}
                className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{p.name}</h3>
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      {p.kind}
                    </span>
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      env: {p.env_key_var}
                    </span>
                  </div>
                  {p.notes && (
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{p.notes}</p>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <th className="pb-1 pr-3">Model</th>
                      <th className="pb-1 pr-3">Modality</th>
                      <th className="pb-1 pr-3">Context</th>
                      <th className="pb-1 pr-3">In $/1M</th>
                      <th className="pb-1">Out $/1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerModels.map((m) => (
                      <tr key={m.id} className="border-t border-[var(--color-border)]">
                        <td className="py-1.5 pr-3 tabular-nums">{m.display_name}</td>
                        <td className="py-1.5 pr-3">{m.modality}</td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {m.context_window ? m.context_window.toLocaleString() : "—"}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {m.input_cost_per_1m !== null ? `$${m.input_cost_per_1m}` : "—"}
                        </td>
                        <td className="py-1.5 tabular-nums">
                          {m.output_cost_per_1m !== null ? `$${m.output_cost_per_1m}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}

      {section === "usage" && <UsageSection />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      }`}
    >
      {children}
    </button>
  );
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
}

function UsageSection() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/usage?days=7");
    const body = (await res.json()) as { data?: UsageData };
    setData(body.data ?? null);
    setLoading(false);
  }

  return (
    <section className="space-y-4">
      <Button onClick={load} disabled={loading} variant="outline">
        {loading ? "Loading…" : data ? "Refresh" : "Load 7-day usage"}
      </Button>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Calls (7d)" value={data.total_calls.toLocaleString()} />
            <Stat label="Cost (7d)" value={`$${data.total_cost_usd.toFixed(4)}`} />
            <Stat
              label="Errors / Fallbacks"
              value={`${data.by_feature.reduce((a, b) => a + b.errors, 0)} / ${data.by_feature.reduce(
                (a, b) => a + b.fallbacks,
                0,
              )}`}
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h4 className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              By feature
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-[var(--color-muted-foreground)]">
                  <th className="pb-1">Feature</th>
                  <th className="pb-1 text-right">Calls</th>
                  <th className="pb-1 text-right">Cost</th>
                  <th className="pb-1 text-right">Err</th>
                  <th className="pb-1 text-right">FB</th>
                </tr>
              </thead>
              <tbody>
                {data.by_feature.map((r) => (
                  <tr key={r.feature} className="border-t border-[var(--color-border)]">
                    <td className="py-1.5">{r.feature}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.calls}</td>
                    <td className="py-1.5 text-right tabular-nums">${r.cost_usd.toFixed(4)}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.errors}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.fallbacks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h4 className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              By model
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-[var(--color-muted-foreground)]">
                  <th className="pb-1">Model</th>
                  <th className="pb-1 text-right">Calls</th>
                  <th className="pb-1 text-right">Cost</th>
                  <th className="pb-1 text-right">Avg ms</th>
                </tr>
              </thead>
              <tbody>
                {data.by_model.map((r) => (
                  <tr key={r.model_string} className="border-t border-[var(--color-border)]">
                    <td className="py-1.5 font-mono text-[11px]">
                      {r.provider_slug}/{r.model_string}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.calls}</td>
                    <td className="py-1.5 text-right tabular-nums">${r.cost_usd.toFixed(4)}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.avg_latency_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
