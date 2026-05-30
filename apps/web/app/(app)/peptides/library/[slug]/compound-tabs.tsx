"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Syringe, FlaskConical, HelpCircle, Calculator, ExternalLink, ChevronDown } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import { cn } from "@/lib/cn";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { DoseAnnotatedText, DoseDisclaimerFooter } from "@/components/peptides/dose-disclaimer";

interface Citation {
  source?: string;
  title?: string;
  url?: string;
  year?: number;
}
interface Protocol {
  id: string;
  context: string;
  route: string | null;
  evidence_level: string;
  is_human_data: boolean;
  notes: string | null;
  range_display: string;
}
interface Synergy {
  id: string;
  paired_name: string;
  rationale: string;
  evidence_level: string;
  is_human_data: boolean;
  caution_notes: string | null;
}
export interface CompoundDetail {
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  evidence_level: string;
  fda_approved: boolean;
  short_description: string;
  mechanism: string | null;
  typical_route: string | null;
  monitoring_notes: string[];
  absolute_contraindications: string[];
  relative_contraindications: string[];
  common_side_effects: string[];
  serious_adverse_events: string[];
  protocols: Protocol[];
  synergies: Synergy[];
  references: Citation[];
  representativeDose: string;
  frequency: string;
}

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "dosing", label: "Dosing & Protocol", icon: Syringe },
  { id: "research", label: "Published Research", icon: FlaskConical },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function CompoundTabs({ detail }: { detail: CompoundDetail }) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {tab === "overview" && <OverviewTab detail={detail} />}
      {tab === "dosing" && <DosingTab detail={detail} />}
      {tab === "research" && <ResearchTab detail={detail} />}
      {tab === "faq" && <FaqTab detail={detail} />}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      {title && <h2 className="mb-3 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function OverviewTab({ detail }: { detail: CompoundDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{detail.short_description}</p>
      </Card>

      {detail.mechanism && (
        <Card title="Mechanism of action">
          <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">{detail.mechanism}</p>
        </Card>
      )}

      {detail.synergies.length > 0 && (
        <Card title="Commonly combined with">
          <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
            Educational pharmacologic rationale only — not a recommended protocol. Review any
            combination with a clinician and against your contraindications.
          </p>
          <ul className="space-y-2">
            {detail.synergies.map((s) => (
              <li key={s.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{s.paired_name}</span>
                  <EvidenceBadge level={s.evidence_level as EvidenceLevel} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{s.rationale}</p>
                {s.caution_notes && (
                  <p className="mt-1 text-xs text-[var(--color-destructive)]">Caution: {s.caution_notes}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CautionsCard detail={detail} />
    </div>
  );
}

function DosingTab({ detail }: { detail: CompoundDetail }) {
  const calcHref = `/peptides/protocols?tab=reconstitution&compound=${encodeURIComponent(detail.slug)}`;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-[var(--color-muted-foreground)]">
        Reference dose: <span className="font-medium text-[var(--color-foreground)]">{detail.representativeDose}</span>
        {detail.frequency !== "—" ? ` · ${detail.frequency}` : ""} — educational, override with your own / clinician values.
      </div>

      {detail.protocols.length > 0 ? (
        <Card title="Dosing protocols (literature reference)">
          <ul className="space-y-3">
            {detail.protocols.map((p) => (
              <li key={p.id} className="rounded-lg border border-[var(--color-border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize">{p.context}</span>
                  <div className="flex items-center gap-2">
                    <EvidenceBadge level={p.evidence_level as EvidenceLevel} />
                    {!p.is_human_data && (
                      <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                        non-human data
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <DoseAnnotatedText text={p.range_display} />
                </div>
                {p.route && (
                  <p className="mt-1 text-xs uppercase text-[var(--color-muted-foreground)]">route: {p.route}</p>
                )}
                {p.notes && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{p.notes}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No established literature dose ranges for this compound. Use values from you or your
            clinician in the calculator.
          </p>
          <DoseDisclaimerFooter />
        </Card>
      )}

      {detail.common_side_effects.length > 0 && (
        <Card title="Potential side effects">
          <ul className="grid gap-1 sm:grid-cols-2">
            {detail.common_side_effects.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-muted-foreground)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link
        href={calcHref}
        className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        <Calculator className="h-4 w-4" /> Open in reconstitution calculator
      </Link>
    </div>
  );
}

function ResearchTab({ detail }: { detail: CompoundDetail }) {
  if (detail.references.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No catalogued references for this compound yet.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-[var(--color-muted-foreground)]">
        References from public sources (PubMed, FDA, ClinicalTrials.gov, journals). Informational
        only — not medical advice.
      </div>
      <ol className="space-y-2">
        {detail.references.map((c, i) => (
          <li key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-foreground)]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.title ?? c.source ?? "Reference"}</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {[c.source, c.year].filter(Boolean).join(" · ")}
                </p>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    View source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FaqTab({ detail }: { detail: CompoundDetail }) {
  const faqs: { q: string; a: string }[] = [];
  faqs.push({
    q: `Is ${detail.name} FDA-approved?`,
    a: detail.fda_approved
      ? `${detail.name} has at least one FDA-approved indication. Approval is specific to the labeled use, dose, and route — uses outside that label are off-label. See the Overview for details.`
      : `No. ${detail.name} is not FDA-approved. It is used in research and/or off-label contexts; quality, dosing, and safety of unregulated sources are unverified.`,
  });
  faqs.push({
    q: "How strong is the evidence?",
    a: `Top-level evidence grade: ${detail.evidence_level.replace(/_/g, " ").toLowerCase()}. Each dose range in the Dosing tab carries its own grade and citation. Animal- or mechanism-only data does not establish human dosing.`,
  });
  if (detail.absolute_contraindications.length > 0 || detail.relative_contraindications.length > 0) {
    faqs.push({
      q: "What are the main safety cautions?",
      a: [
        detail.absolute_contraindications.length
          ? `Absolute: ${detail.absolute_contraindications.join("; ")}.`
          : "",
        detail.relative_contraindications.length
          ? `Relative: ${detail.relative_contraindications.join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (detail.synergies.length > 0) {
    faqs.push({
      q: "What is it commonly combined with?",
      a: `Educationally discussed combinations: ${detail.synergies.map((s) => s.paired_name).join(", ")}. These are pharmacologic rationale only, not recommended protocols — see the Overview tab.`,
    });
  }

  return (
    <div className="space-y-2">
      {faqs.map((f, i) => (
        <FaqItem key={i} q={f.q} a={f.a} />
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
      >
        {q}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <p className="border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
          {a}
        </p>
      )}
    </div>
  );
}

function CautionsCard({ detail }: { detail: CompoundDetail }) {
  const hasAny =
    detail.absolute_contraindications.length > 0 ||
    detail.relative_contraindications.length > 0 ||
    detail.serious_adverse_events.length > 0 ||
    detail.monitoring_notes.length > 0;
  if (!hasAny) return null;
  return (
    <Card title="Safety & monitoring">
      {detail.absolute_contraindications.length > 0 && (
        <Block label="Do not use if" tone="danger" items={detail.absolute_contraindications} />
      )}
      {detail.relative_contraindications.length > 0 && (
        <Block label="Use caution if" tone="warn" items={detail.relative_contraindications} />
      )}
      {detail.serious_adverse_events.length > 0 && (
        <Block label="Serious adverse events" tone="warn" items={detail.serious_adverse_events} />
      )}
      {detail.monitoring_notes.length > 0 && (
        <Block label="Monitoring" tone="muted" items={detail.monitoring_notes} />
      )}
    </Card>
  );
}

function Block({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "danger" | "warn" | "muted";
  items: string[];
}) {
  const color =
    tone === "danger"
      ? "text-[var(--color-destructive)]"
      : tone === "warn"
        ? "text-[var(--color-accent)]"
        : "text-[var(--color-muted-foreground)]";
  return (
    <div className="mt-3 first:mt-0">
      <p className={cn("text-xs font-semibold uppercase tracking-wide", color)}>{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-[var(--color-muted-foreground)]">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
