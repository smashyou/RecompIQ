"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { metricsForGoals, METRIC_BY_KEY, type GoalKey, type MetricDef } from "@peptide/shared";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { Card } from "@/components/kit";
import { CognitionTest } from "@/components/cognition-test";

// Nearest anchor label for the current slider value (helper text for self-checks).
function nearestAnchor(m: MetricDef, value: number): string | null {
  if (!m.anchors?.length) return null;
  let best = m.anchors[0]!;
  for (const a of m.anchors) {
    if (Math.abs(a.value - value) < Math.abs(best.value - value)) best = a;
  }
  return best.label;
}

export function GoalMetricsForm({
  showNeuro = false,
  showNausea = false,
}: {
  showNeuro?: boolean;
  showNausea?: boolean;
} = {}) {
  const router = useRouter();
  const toast = useFireToast();
  const [goalKeys, setGoalKeys] = useState<GoalKey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((b) => setGoalKeys(((b.data ?? []) as { goal_key: GoalKey }[]).map((g) => g.goal_key)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Safety self-checks: surfaced when the user has a neuro-related condition
  // (nerve symptoms) or any active regimen compound (nausea). These are ordinary
  // goal_metrics rows the safety engine reads — never free-text symptom entry.
  const selfChecks = useMemo<MetricDef[]>(() => {
    const out: MetricDef[] = [];
    if (showNeuro && METRIC_BY_KEY.neuro_severity) out.push(METRIC_BY_KEY.neuro_severity);
    if (showNausea && METRIC_BY_KEY.nausea_severity) out.push(METRIC_BY_KEY.nausea_severity);
    return out;
  }, [showNeuro, showNausea]);

  const metrics = useMemo<MetricDef[]>(() => {
    const goalMetrics = metricsForGoals(goalKeys).filter((m) => m.kind !== "objective");
    const seen = new Set(goalMetrics.map((m) => m.key));
    return [...goalMetrics, ...selfChecks.filter((m) => !seen.has(m.key))];
  }, [goalKeys, selfChecks]);
  const showCognition = goalKeys.includes("cognition" as GoalKey);
  const [cognitionOpen, setCognitionOpen] = useState(false);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    const entries = metrics
      .filter((m) => values[m.key] !== undefined && values[m.key] !== "")
      .map((m) => ({ metric_key: m.key, value: Number(values[m.key]), unit: m.unit }));
    if (entries.length === 0) return toast.error("Enter at least one value.");
    setBusy(true);
    const res = await fetch("/api/goal-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics: entries }),
    });
    setBusy(false);
    if (res.status === 401) return router.replace("/signin?next=/log?tab=goals");
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      return toast.error(b.error?.message ?? "Could not save");
    }
    toast.success(`Logged ${entries.length} metric${entries.length === 1 ? "" : "s"}`);
    setValues({});
    router.refresh();
  }

  if (!loaded) {
    return <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">Loading…</p>;
  }

  if (metrics.length === 0) {
    return (
      <Card style={{ borderStyle: "dashed" }}>
        <div className="py-6 text-center">
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            No goal metrics to log yet.{" "}
            <Link href="/goals" className="text-[var(--primary)] underline">
              Pick your goals
            </Link>{" "}
            and their tracked signals appear here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
    <Card title="Today's goal check-in">
      <div className="space-y-4">
        {metrics.map((m) => (
          <div key={m.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs">
                {m.label}
                {m.hint ? <span className="ml-2 text-2xs text-[var(--fg-subtle)]">{m.hint}</span> : null}
              </Label>
              <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--fg)]">
                {values[m.key] ?? "—"}
                <span className="ml-1 text-2xs text-[var(--fg-subtle)]">{m.unit === "cm" ? "cm" : ""}</span>
              </span>
            </div>
            {m.kind === "rating" ? (
              <>
                <input
                  type="range"
                  min={m.min}
                  max={m.max}
                  step={1}
                  value={values[m.key] ?? String(Math.round((m.min + m.max) / 2))}
                  onChange={(e) => set(m.key, e.target.value)}
                  className="w-full accent-[var(--primary)]"
                />
                {m.anchors?.length
                  ? (() => {
                      const cur = Number(
                        values[m.key] ?? String(Math.round((m.min + m.max) / 2)),
                      );
                      const anchor = nearestAnchor(m, cur);
                      return anchor ? (
                        <p className="font-[family-name:var(--font-sans)] text-2xs leading-snug text-[var(--fg-subtle)]">
                          {anchor}
                        </p>
                      ) : null;
                    })()
                  : null}
              </>
            ) : (
              <Input
                type="number"
                step="0.1"
                min={m.min}
                max={m.max}
                value={values[m.key] ?? ""}
                placeholder={`${m.unit}`}
                onChange={(e) => set(m.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <Button onClick={save} disabled={busy} className="w-full">
          {busy ? "Saving…" : "Log check-in"}
        </Button>
        <p className="font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-subtle)]">
          Self-reported trends, not clinical measurements.
        </p>
      </div>
    </Card>

    {showCognition &&
      (cognitionOpen ? (
        <CognitionTest onClose={() => setCognitionOpen(false)} />
      ) : (
        <Button variant="outline" onClick={() => setCognitionOpen(true)} className="w-full gap-2">
          <Brain size={16} /> Take the 30-sec cognition check
        </Button>
      ))}
    </div>
  );
}
