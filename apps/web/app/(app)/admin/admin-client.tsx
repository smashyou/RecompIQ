"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { Card, Chip, MetricBox, Overline, SectionHeader } from "@/components/kit";

interface Provider {
  id: string;
  slug: string;
  name: string;
  kind: string;
  env_key_var: string;
  notes: string | null;
  configured: boolean;
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

const SELECT_CLASS =
  "flex h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 font-[family-name:var(--font-sans)] text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

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
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerTests, setProviderTests] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const modelsByModality = useMemo(() => {
    const map = new Map<string, ModelRow[]>();
    for (const m of models) {
      const arr = map.get(m.modality) ?? [];
      arr.push(m);
      map.set(m.modality, arr);
    }
    return map;
  }, [models]);

  // A model is selectable only if its provider's API key is set on THIS deploy
  // (e.g. gateway/openrouter models can't be picked when their key isn't in
  // Vercel) — prevents saving a feature config that errors at call time.
  const configuredSlugs = useMemo(
    () => new Set(providers.filter((p) => p.configured).map((p) => p.slug)),
    [providers],
  );
  const isConfigured = (m: ModelRow) => configuredSlugs.has(m.ai_providers.slug);

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

  async function testProvider(slug: string) {
    setTestingProvider(slug);
    const res = await fetch("/api/admin/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setTestingProvider(null);
    const body = (await res.json()) as {
      data?: { ok: boolean; configured?: boolean; latencyMs?: number; error?: string };
    };
    const d = body.data;
    if (d?.ok) {
      const msg = `reachable · ${d.latencyMs}ms`;
      setProviderTests((prev) => ({ ...prev, [slug]: { ok: true, msg } }));
      toast.success(`${slug} ok · ${msg}`);
    } else {
      const msg = d?.error ?? "test failed";
      setProviderTests((prev) => ({ ...prev, [slug]: { ok: false, msg } }));
      toast.error(`${slug}: ${msg}`);
    }
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
    <div className="flex w-full flex-col gap-[18px]">
      <SectionHeader
        num="—"
        title="Admin"
        note="AI provider config, per-feature model selection, and usage monitoring."
      />

      <div className="flex flex-wrap gap-2">
        <Chip active={section === "features"} onClick={() => setSection("features")}>
          Feature config
        </Chip>
        <Chip active={section === "catalog"} onClick={() => setSection("catalog")}>
          Model catalog
        </Chip>
        <Chip active={section === "usage"} onClick={() => setSection("usage")}>
          Usage
        </Chip>
      </div>

      {section === "features" && (
        <div className="flex flex-col gap-[var(--space-grid)]">
          {Object.entries(FEATURE_INFO).map(([feature, info]) => {
            const cfg = configState.find((c) => c.feature === feature);
            const available = modelsForFeature(feature);
            const primary = cfg?.primary_model_id ?? available[0]?.id ?? "";
            const fallbacks = cfg?.fallback_ids ?? [];
            return (
              <Card key={feature} title={info.label} hint={info.modality}>
                <p className="-mt-2 mb-4 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                  {info.description}
                </p>

                <div className="space-y-2">
                  <Overline style={{ fontSize: "var(--text-2xs)" }}>Primary model</Overline>
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
                    className={SELECT_CLASS}
                  >
                    {available.map((m) => {
                      const ok = isConfigured(m);
                      return (
                        <option key={m.id} value={m.id} disabled={!ok}>
                          {m.display_name} — {m.ai_providers.slug}
                          {ok ? "" : " · key not set"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="mt-4 space-y-2">
                  <Overline style={{ fontSize: "var(--text-2xs)" }}>Fallback chain ({fallbacks.length})</Overline>
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
                          className={`${SELECT_CLASS} h-9 flex-1`}
                        >
                          {available.map((m) => {
                            const ok = isConfigured(m);
                            return (
                              <option key={m.id} value={m.id} disabled={!ok}>
                                {m.display_name} — {m.ai_providers.slug}
                                {ok ? "" : " · key not set"}
                              </option>
                            );
                          })}
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
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                          aria-label="Remove fallback"
                        >
                          ✕
                        </button>
                        {fbModel && (
                          <button
                            type="button"
                            onClick={() => testModel(fbId)}
                            disabled={testing === fbId}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                            title="Test connection"
                          >
                            {testing === fbId ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : testResults[fbId]?.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--positive)]" />
                            ) : testResults[fbId] ? (
                              <XCircle className="h-3.5 w-3.5 text-[var(--danger)]" />
                            ) : (
                              <Activity className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const eligible = available.filter(
                        (m) => m.id !== primary && !fallbacks.includes(m.id),
                      );
                      const next = eligible.find((m) => isConfigured(m)) ?? eligible[0];
                      if (!next) return;
                      const newFbs = [...fallbacks, next.id];
                      setConfigState((prev) =>
                        prev.map((c) =>
                          c.feature === feature ? { ...c, fallback_ids: newFbs } : c,
                        ),
                      );
                    }}
                    className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  >
                    + Add fallback
                  </button>
                </div>

                <div className="mt-4 flex gap-2">
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
                    className="mt-2 font-mono text-xs"
                    style={{
                      color: testResults[primary]!.ok ? "var(--positive)" : "var(--danger)",
                    }}
                  >
                    {testResults[primary]!.msg}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {section === "catalog" && (
        <div className="flex flex-col gap-[var(--space-grid)]">
          {providers.map((p) => {
            const providerModels = models.filter((m) => m.ai_providers.slug === p.slug);
            return (
              <Card key={p.id} title={p.name}>
                <div className="-mt-2 mb-3 flex flex-wrap items-center gap-2">
                  {p.configured ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] border border-[var(--positive-line)] bg-[var(--positive-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-2xs font-semibold uppercase tracking-wide text-[var(--positive)]">
                      <CheckCircle2 size={12} /> Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-2xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                      <XCircle size={12} /> Not configured
                    </span>
                  )}
                  <Chip>{p.kind}</Chip>
                  <Chip>env: {p.env_key_var}</Chip>
                  <button
                    onClick={() => testProvider(p.slug)}
                    disabled={!p.configured || testingProvider === p.slug}
                    className="ml-auto inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--border)] px-2.5 py-1 font-[family-name:var(--font-sans)] text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--primary-line)] hover:text-[var(--fg)] disabled:opacity-50"
                    title={p.configured ? "Make a live test call" : `Set ${p.env_key_var} to enable`}
                  >
                    {testingProvider === p.slug ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Activity size={12} />
                    )}
                    Test connection
                  </button>
                </div>
                {providerTests[p.slug] && (
                  <div
                    className={`-mt-1 mb-3 font-[family-name:var(--font-sans)] text-xs ${
                      providerTests[p.slug]!.ok ? "text-[var(--positive)]" : "text-[var(--danger-bright)]"
                    }`}
                  >
                    {providerTests[p.slug]!.ok ? "✓ " : "✕ "}
                    {providerTests[p.slug]!.msg}
                  </div>
                )}
                {!p.configured && (
                  <p className="-mt-1 mb-3 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                    Set <code className="font-[family-name:var(--font-mono)]">{p.env_key_var}</code> in the
                    server environment (Vercel → Settings → Environment Variables) to enable this provider.
                  </p>
                )}
                {p.notes && (
                  <p className="mb-3 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                    {p.notes}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full font-[family-name:var(--font-sans)] text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-2 pr-3"><Overline style={{ fontSize: "var(--text-2xs)" }}>Model</Overline></th>
                        <th className="pb-2 pr-3"><Overline style={{ fontSize: "var(--text-2xs)" }}>Modality</Overline></th>
                        <th className="pb-2 pr-3 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Context</Overline></th>
                        <th className="pb-2 pr-3 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>In $/1M</Overline></th>
                        <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Out $/1M</Overline></th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerModels.map((m) => (
                        <tr key={m.id} className="border-t border-[var(--border)]">
                          <td className="py-2 pr-3 text-[var(--fg)]">{m.display_name}</td>
                          <td className="py-2 pr-3 text-[var(--fg-muted)]">{m.modality}</td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--fg)]">
                            {m.context_window ? m.context_window.toLocaleString() : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--fg)]">
                            {m.input_cost_per_1m !== null ? `$${m.input_cost_per_1m}` : "—"}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">
                            {m.output_cost_per_1m !== null ? `$${m.output_cost_per_1m}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {section === "usage" && <UsageSection />}
    </div>
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
    <div className="flex flex-col gap-[var(--space-grid)]">
      <div>
        <Button onClick={load} disabled={loading} variant="outline">
          {loading ? "Loading…" : data ? "Refresh" : "Load 7-day usage"}
        </Button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricBox label="Calls (7d)" value={data.total_calls.toLocaleString()} />
            <MetricBox label="Cost (7d)" value={`$${data.total_cost_usd.toFixed(4)}`} />
            <MetricBox
              label="Errors / Fallbacks"
              value={`${data.by_feature.reduce((a, b) => a + b.errors, 0)} / ${data.by_feature.reduce(
                (a, b) => a + b.fallbacks,
                0,
              )}`}
            />
          </div>

          <Card title="By feature">
            <div className="overflow-x-auto">
              <table className="w-full font-[family-name:var(--font-sans)] text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2"><Overline style={{ fontSize: "var(--text-2xs)" }}>Feature</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Calls</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Cost</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Err</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>FB</Overline></th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_feature.map((r) => (
                    <tr key={r.feature} className="border-t border-[var(--border)]">
                      <td className="py-2 text-[var(--fg)]">{r.feature}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">{r.calls}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">
                        ${r.cost_usd.toFixed(4)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">{r.errors}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">{r.fallbacks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="By model">
            <div className="overflow-x-auto">
              <table className="w-full font-[family-name:var(--font-sans)] text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2"><Overline style={{ fontSize: "var(--text-2xs)" }}>Model</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Calls</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Cost</Overline></th>
                    <th className="pb-2 text-right"><Overline style={{ fontSize: "var(--text-2xs)" }}>Avg ms</Overline></th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_model.map((r) => (
                    <tr key={r.model_string} className="border-t border-[var(--border)]">
                      <td className="py-2 font-mono text-2xs text-[var(--fg)]">
                        {r.provider_slug}/{r.model_string}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">{r.calls}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">
                        ${r.cost_usd.toFixed(4)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--fg)]">
                        {r.avg_latency_ms}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
