"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { DoseAnnotatedText, DoseDisclaimerFooter } from "@/components/peptides/dose-disclaimer";
import { Card, Overline } from "@/components/kit";

function prettify(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  contraindications: { severity: string; compoundName?: string; reason?: string; suggestion?: string }[];
}

export function GoalsClient({
  initialSelected,
  compoundNames,
}: {
  initialSelected: string[];
  compoundNames: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useFireToast();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [savingGoals, setSavingGoals] = useState(false);

  const [freeText, setFreeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<StackerResponse | null>(null);
  const [applying, setApplying] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function saveGoals() {
    setSavingGoals(true);
    const res = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goals: selected.map((goal_key, i) => ({ goal_key, priority: i + 1, status: "active" })),
      }),
    });
    setSavingGoals(false);
    if (res.status === 401) return router.replace("/signin?next=/goals");
    if (!res.ok) return toast.error("Could not save goals");
    toast.success(selected.length ? `${selected.length} goal${selected.length === 1 ? "" : "s"} saved` : "Goals cleared");
    router.refresh();
  }

  async function generate() {
    if (selected.length === 0 && !freeText.trim()) {
      return toast.error("Pick a goal or describe what you want.");
    }
    setGenerating(true);
    setPlan(null);
    const res = await fetch("/api/stacker/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_keys: selected, free_text: freeText.trim() || null }),
    });
    setGenerating(false);
    if (res.status === 401) return router.replace("/signin?next=/goals");
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      return toast.error(b.error?.message ?? "Could not generate a plan");
    }
    const body = (await res.json()) as { data: StackerResponse };
    setPlan(body.data);
  }

  async function applyPlan() {
    if (!plan) return;
    setApplying(true);
    const goalKeys = Array.from(new Set([...selected, ...plan.plan.detected_goal_keys])).filter((k) =>
      GOAL_TAXONOMY.some((g) => g.key === k),
    );
    const res = await fetch("/api/stacker/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan.plan, goal_keys: goalKeys }),
    });
    setApplying(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      return toast.error(b.error?.message ?? "Could not apply the plan");
    }
    toast.success("Plan applied to your regimen — set your own doses next");
    router.push("/peptides");
  }

  return (
    <div className="space-y-6">
      {/* multi-select goal cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {GOAL_TAXONOMY.map((g) => {
          const on = selected.includes(g.key);
          const rank = selected.indexOf(g.key) + 1;
          return (
            <button key={g.key} type="button" onClick={() => toggle(g.key)} className="text-left">
              <Card
                style={{
                  borderColor: on ? "var(--primary-line)" : "var(--border)",
                  background: on ? "var(--primary-wash)" : "var(--surface-1)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                        {g.label}
                      </h3>
                      {g.hasV1Projection && (
                        <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-px font-[family-name:var(--font-sans)] text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                          projected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                      {g.blurb}
                    </p>
                  </div>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      on ? "border-[var(--primary-line)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-transparent"
                    }`}
                  >
                    {on ? <Check size={12} /> : null}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {g.representativeSlugs.slice(0, 4).map((slug) => (
                    <span
                      key={slug}
                      className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]"
                    >
                      {compoundNames[slug] ?? prettify(slug)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]">
                  Tracks: {g.signals.join(" · ")}
                  {on && rank > 0 ? `  ·  priority ${rank}` : ""}
                </p>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={saveGoals} disabled={savingGoals} variant="outline">
          {savingGoals ? "Saving…" : "Save goals"}
        </Button>
        <Overline>{selected.length} selected</Overline>
      </div>

      {/* NL box + AI auto-stacker */}
      <Card title="Ask the AI to assemble a plan">
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
            Describe what you want in plain language (or just use your selected goals). The AI proposes
            an evidence-graded, phased plan — suggestions you accept and edit. It never prescribes.
          </p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g. I want to drop ~40 lb, then put on muscle, and my skin + sleep could be better."
            rows={3}
            className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-line)]"
          />
          <Button onClick={generate} disabled={generating} className="gap-2">
            <Sparkles size={16} /> {generating ? "Thinking…" : "Generate plan"}
          </Button>
        </div>
      </Card>

      {/* review */}
      {plan && (
        <div className="space-y-3">
          <Overline>Proposed plan · review before applying</Overline>

          <Card>
            <div className="font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg)]">
              <DoseAnnotatedText text={plan.plan.summary} showFooter={false} />
            </div>
            {plan.plan.phasing_rationale && (
              <div className="mt-2 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                <DoseAnnotatedText text={plan.plan.phasing_rationale} showFooter={false} />
              </div>
            )}
            <div className="mt-3">
              <DoseDisclaimerFooter />
            </div>
          </Card>

          {plan.plan.warnings.length > 0 && (
            <div className="rounded-[var(--r-md)] border px-4 py-3" style={{ borderColor: "var(--warn-line)", background: "var(--warn-wash)" }}>
              <Overline style={{ color: "var(--warn)" }}>Heads up</Overline>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                {plan.plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.contraindications.length > 0 ? (
            <ContraindicationBanner findings={plan.contraindications as never} />
          ) : (
            <p className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
              No contraindications found against your recorded conditions and medications. This is not
              a substitute for clinician review.
            </p>
          )}

          {plan.plan.phases.map((phase, pi) => (
            <Card key={pi} pad={0}>
              <div className="border-b border-[var(--border)] px-[18px] py-3">
                <div className="flex items-baseline gap-2">
                  <Overline style={{ fontSize: 9 }}>Phase {pi + 1}</Overline>
                  <h3 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--fg)]">
                    {phase.name}
                  </h3>
                </div>
                {phase.rationale && (
                  <div className="mt-1 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                    <DoseAnnotatedText text={phase.rationale} showFooter={false} />
                  </div>
                )}
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {phase.items.map((it, ii) => (
                  <li key={ii} className="px-[18px] py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)]">
                        {it.name}
                      </span>
                      <EvidenceBadge level={it.evidence_level as never} fdaApproved={false} />
                    </div>
                    <div className="mt-0.5 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                      <DoseAnnotatedText text={it.why} showFooter={false} />
                    </div>
                    {it.literature_dose_text && (
                      <div className="mt-1 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg)]">
                        <DoseAnnotatedText text={it.literature_dose_text} showFooter={false} />
                      </div>
                    )}
                    {it.cautions.length > 0 && (
                      <p className="mt-1 font-[family-name:var(--font-sans)] text-[11px] text-[var(--warn)]">
                        Caution: {it.cautions.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {plan.plan.clinician_points.length > 0 && (
            <Card title="Discuss with your clinician">
              <ul className="list-disc space-y-1 pl-4 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                {plan.plan.clinician_points.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={applyPlan} disabled={applying}>
              {applying ? "Applying…" : "Apply to my regimen"}
            </Button>
            <Button variant="outline" onClick={() => setPlan(null)}>
              Discard
            </Button>
          </div>
          <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
            Applying adds these as AI-suggested items with <strong>no dose set</strong> — you (or your
            clinician) decide the dose. Educational only, not a prescription.
          </p>
        </div>
      )}
    </div>
  );
}
