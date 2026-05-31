"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ExternalLink,
  ChevronDown,
  Check,
} from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import type { ContraindicationFinding } from "@peptide/peptides";
import { cn } from "@/lib/cn";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
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
export interface BlendComponent {
  slug: string;
  name: string;
  evidence_level: string;
  fda_approved: boolean;
  absolute_contraindications: string[];
  relative_contraindications: string[];
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
  is_blend: boolean;
  components: BlendComponent[];
  component_mg: { label: string; mg: number | null }[];
  typical_vial_mg: number | null;
  componentDosing: {
    slug: string;
    name: string;
    range_display: string;
    route: string | null;
    evidence_level: string;
    is_human_data: boolean;
  }[];
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

// ── Reference primitives ────────────────────────────────────────────────────
// Card mirrors Design/.../Primitives.jsx <Card>: surface-1 + border + r-lg,
// header row with sans-600 title + optional uppercase 9.5px hint.
function Card({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-[18px]",
        className,
      )}
    >
      {(title || hint) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {title && (
            <h2 className="font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--fg)]">
              {title}
            </h2>
          )}
          {hint && (
            <span className="font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              {hint}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

// Sec = a Card with a 14px bottom margin (the reference's stacked section rhythm).
function Sec({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Card title={title} className="mb-[14px]">
      {children}
    </Card>
  );
}

const bodyText =
  "font-[family-name:var(--font-sans)] text-[14px] leading-[1.6] text-[var(--fg-muted)] [text-wrap:pretty]";

// Turn the compound's own plain-string contraindications into findings so we can
// reuse <ContraindicationBanner> verbatim. These are the compound's labelled
// cautions (not matched against the user), so matchedAgainst reflects that.
function selfFindings(
  name: string,
  slug: string,
  absolute: string[],
  relative: string[],
): ContraindicationFinding[] {
  return [
    ...absolute.map((reason) => ({
      compoundSlug: slug,
      compoundName: name,
      severity: "absolute" as const,
      reason,
      matchedAgainst: "this compound’s label",
    })),
    ...relative.map((reason) => ({
      compoundSlug: slug,
      compoundName: name,
      severity: "relative" as const,
      reason,
      matchedAgainst: "this compound’s label",
    })),
  ];
}

export function CompoundTabs({ detail }: { detail: CompoundDetail }) {
  const calcHref = `/peptides/protocols?tab=reconstitution&compound=${encodeURIComponent(detail.slug)}`;

  const findings = selfFindings(
    detail.name,
    detail.slug,
    detail.absolute_contraindications,
    detail.relative_contraindications,
  );

  return (
    <div>
      {/* blend note (real) — shown before the summary for blends */}
      {detail.is_blend && (
        <Sec>
          <p className="font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--fg)]">
            This is a multi-peptide blend
          </p>
          <p className="mt-1 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
            Blends are community/vendor combinations, not single compounds, and are not
            FDA-approved. There is no established human dose for the combined product — each
            component has its own evidence and cautions below. Compositions vary by source;
            sourcing and purity of unregulated blends are unverified.
          </p>
        </Sec>
      )}

      {/* Summary */}
      <Sec title="Summary">
        <p className={bodyText}>{detail.short_description}</p>
      </Sec>

      {/* Components (blends only) */}
      {detail.is_blend && detail.components.length > 0 && <ComponentsCard detail={detail} />}

      {/* Mechanism */}
      {detail.mechanism && (
        <Sec title="Mechanism">
          <p className={bodyText}>{detail.mechanism}</p>
        </Sec>
      )}

      {/* Contraindications — reuse <ContraindicationBanner> (absolute=danger / relative=warn) */}
      {findings.length > 0 && (
        <Card title="Contraindications" hint="this compound" className="mb-[14px]">
          <ContraindicationBanner findings={findings} />
        </Card>
      )}

      {/* Dosing — literature reference, doses via DoseAnnotatedText */}
      <DosingSection detail={detail} calcHref={calcHref} />

      {/* Side effects */}
      {detail.common_side_effects.length > 0 && (
        <Sec title="Potential side effects">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {detail.common_side_effects.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.45] text-[var(--fg-muted)]"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warn)]" />
                {s}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {/* Serious adverse events */}
      {detail.serious_adverse_events.length > 0 && (
        <Sec title="Serious adverse events">
          <ul className="space-y-1.5">
            {detail.serious_adverse_events.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.45] text-[var(--fg-muted)]"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" />
                {s}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {/* Monitoring checklist — 2-col grid with check chips (reference) */}
      {detail.monitoring_notes.length > 0 && (
        <Sec title="Monitoring checklist">
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {detail.monitoring_notes.map((t, i) => (
              <li
                key={i}
                className="flex gap-2 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.45] text-[var(--fg-muted)]"
              >
                <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-[5px] bg-[var(--surface-2)] text-[var(--primary)]">
                  <Check size={11} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {/* Commonly stacked with (real synergies) */}
      {detail.synergies.length > 0 && (
        <Sec title="Commonly stacked with">
          <p className="mb-3 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-subtle)]">
            Educational pharmacologic rationale only — not a recommended protocol. Review any
            combination with a clinician and against your contraindications.
          </p>
          <ul className="space-y-2">
            {detail.synergies.map((s) => (
              <li key={s.id} className="rounded-[var(--r-md)] border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
                    {s.paired_name}
                  </span>
                  <EvidenceBadge level={s.evidence_level as EvidenceLevel} />
                </div>
                <p className="mt-1 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                  {s.rationale}
                </p>
                {s.caution_notes && (
                  <p className="mt-1 font-[family-name:var(--font-sans)] text-[12px] text-[var(--danger)]">
                    Caution: {s.caution_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Sec>
      )}

      {/* Evidence & citations (reference list style) */}
      <Sec title="Evidence & citations">
        {detail.references.length > 0 ? (
          <div className="flex flex-col">
            {detail.references.map((c, i) => {
              const meta = [c.source, c.year].filter(Boolean).join(" · ");
              const inner = (
                <>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--primary)]">
                    [{i + 1}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]">
                      {c.title ?? c.source ?? "Reference"}
                    </div>
                    {meta && (
                      <div className="mt-0.5 font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                        {meta}
                      </div>
                    )}
                  </div>
                  {c.url && <ExternalLink size={15} className="shrink-0 text-[var(--fg-subtle)]" />}
                </>
              );
              const rowCls = cn(
                "flex items-center gap-3 py-[11px]",
                i > 0 && "border-t border-[var(--border)]",
              );
              return c.url ? (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(rowCls, "no-underline")}
                >
                  {inner}
                </a>
              ) : (
                <div key={i} className={rowCls}>
                  {inner}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
            No catalogued references for this compound yet.
          </p>
        )}
      </Sec>

      {/* FAQ (real, derived) */}
      <FaqSection detail={detail} />
    </div>
  );
}

function DosingSection({
  detail,
  calcHref,
}: {
  detail: CompoundDetail;
  calcHref: string;
}) {
  // Blends: no validated combined dose — show per-component reference ranges.
  if (detail.is_blend) {
    return (
      <Sec title="Dosing — literature reference">
        <div className="mb-3 rounded-[var(--r-md)] border border-[var(--warn-line)] bg-[var(--warn-wash)] p-3">
          <p className="font-[family-name:var(--font-sans)] text-[12.5px] font-semibold text-[var(--fg)]">
            How a blend is dosed
          </p>
          <p className="mt-1 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-muted)]">
            A blend is drawn as a single volume from the reconstituted mixed vial, so the
            &ldquo;dose&rdquo; depends on how it was mixed. There is no validated combined-product
            dose. The per-component reference ranges below are what each ingredient contributes —
            educational only, not a recommended protocol.
          </p>
        </div>

        {detail.componentDosing.length > 0 ? (
          <ul className="space-y-3">
            {detail.componentDosing.map((c) => (
              <li key={c.slug} className="rounded-[var(--r-md)] border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/peptides/library/${c.slug}`}
                    className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                  >
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <EvidenceBadge level={c.evidence_level as EvidenceLevel} />
                    {!c.is_human_data && <NonHumanPill />}
                  </div>
                </div>
                <div className="mt-2 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]">
                  <DoseAnnotatedText text={c.range_display} />
                </div>
                {c.route && <RoutePill route={c.route} />}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
              Component reference ranges aren&apos;t catalogued yet. See each component above.
            </p>
            <DoseDisclaimerFooter />
          </>
        )}

        <CalculatorLink href={calcHref} />
      </Sec>
    );
  }

  return (
    <Sec title="Dosing — literature reference">
      <div className="mb-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
        Reference dose:{" "}
        <span className="font-medium text-[var(--fg)]">{detail.representativeDose}</span>
        {detail.frequency !== "—" ? ` · ${detail.frequency}` : ""} — educational, override with your
        own / clinician values.
      </div>

      {detail.protocols.length > 0 ? (
        <ul className="space-y-3">
          {detail.protocols.map((p) => (
            <li key={p.id} className="rounded-[var(--r-md)] border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium capitalize text-[var(--fg)]">
                  {p.context}
                </span>
                <div className="flex items-center gap-2">
                  <EvidenceBadge level={p.evidence_level as EvidenceLevel} />
                  {!p.is_human_data && <NonHumanPill />}
                </div>
              </div>
              <div className="mt-2 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]">
                <DoseAnnotatedText text={p.range_display} />
              </div>
              {p.route && <RoutePill route={p.route} />}
              {p.notes && (
                <p className="mt-1 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                  {p.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
            No established literature dose ranges for this compound. Use values from you or your
            clinician in the calculator.
          </p>
          <DoseDisclaimerFooter />
        </>
      )}

      <CalculatorLink href={calcHref} />
    </Sec>
  );
}

function NonHumanPill() {
  return (
    <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-sans)] text-[10px] text-[var(--fg-muted)]">
      non-human data
    </span>
  );
}

function RoutePill({ route }: { route: string }) {
  return (
    <p className="mt-1 font-[family-name:var(--font-sans)] text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">
      route: {route}
    </p>
  );
}

function CalculatorLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="mt-4 flex items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--primary)] px-4 py-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
    >
      <Calculator className="h-4 w-4" /> Open in reconstitution calculator
    </Link>
  );
}

function ComponentsCard({ detail }: { detail: CompoundDetail }) {
  const combinedAbsolute = Array.from(
    new Set(detail.components.flatMap((c) => c.absolute_contraindications)),
  );
  const total = detail.component_mg.reduce((n, c) => n + (c.mg ?? 0), 0);
  return (
    <Card title={`Components (${detail.components.length})`} className="mb-[14px]">
      {detail.component_mg.length > 0 && (
        <div className="mb-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
            Composition
          </p>
          <p className="mt-1 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)]">
            {detail.component_mg
              .map((c) => `${c.label}${c.mg !== null ? ` ${c.mg} mg` : ""}`)
              .join(" / ")}
            {total > 0 && (
              <span className="text-[var(--fg-subtle)]">
                {" "}
                · {detail.typical_vial_mg ?? total} mg total
              </span>
            )}
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {detail.components.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/peptides/library/${c.slug}`}
              className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--border)] p-3 transition-colors hover:border-[var(--primary)]"
            >
              <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
                {c.name}
              </span>
              <EvidenceBadge level={c.evidence_level as EvidenceLevel} fdaApproved={c.fda_approved} />
            </Link>
          </li>
        ))}
      </ul>
      {combinedAbsolute.length > 0 && (
        <div className="mt-3 rounded-[var(--r-md)] border border-[var(--danger-line)] bg-[var(--danger-wash)] p-3">
          <p className="font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--danger-bright)]">
            Combined — do not use if (union of all components)
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
            {combinedAbsolute.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function FaqSection({ detail }: { detail: CompoundDetail }) {
  const faqs: { q: string; a: string }[] = [];
  faqs.push({
    q: `Is ${detail.name} FDA-approved?`,
    a: detail.fda_approved
      ? `${detail.name} has at least one FDA-approved indication. Approval is specific to the labeled use, dose, and route — uses outside that label are off-label. See the Summary for details.`
      : `No. ${detail.name} is not FDA-approved. It is used in research and/or off-label contexts; quality, dosing, and safety of unregulated sources are unverified.`,
  });
  faqs.push({
    q: "How strong is the evidence?",
    a: `Top-level evidence grade: ${detail.evidence_level.replace(/_/g, " ").toLowerCase()}. Each dose range above carries its own grade and citation. Animal- or mechanism-only data does not establish human dosing.`,
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
      a: `Educationally discussed combinations: ${detail.synergies
        .map((s) => s.paired_name)
        .join(", ")}. These are pharmacologic rationale only, not recommended protocols — see above.`,
    });
  }

  if (faqs.length === 0) return null;

  return (
    <Sec title="FAQ">
      <div className="space-y-2">
        {faqs.map((f, i) => (
          <FaqItem key={i} q={f.q} a={f.a} />
        ))}
      </div>
    </Sec>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]"
      >
        {q}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <p className="border-t border-[var(--border)] px-4 py-3 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.55] text-[var(--fg-muted)]">
          {a}
        </p>
      )}
    </div>
  );
}
