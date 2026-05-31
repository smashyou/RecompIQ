"use client";

import { useEffect, useRef, useState } from "react";
import type { EvidenceLevel } from "@peptide/shared";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { DoseAnnotatedText } from "@/components/peptides/dose-disclaimer";

export interface DoseReference {
  id: string;
  context: string;
  route: string | null;
  unit: string;
  frequency: string | null;
  evidence_level: string;
  is_human_data: boolean;
  citation: { source?: string; title?: string; url?: string; year?: number }[];
  notes: string | null;
  range_display: string; // pre-wrapped with [edu] tags
  low_value: number | null;
  high_value: number | null;
}

export interface CompoundSynergy {
  id: string;
  paired_name: string;
  rationale: string;
  evidence_level: string;
  is_human_data: boolean;
  caution_notes: string | null;
}

export interface ReferenceCompound {
  id: string;
  slug: string;
  name: string;
  evidence_level: string;
  fda_approved: boolean;
  mechanism: string | null;
  monitoring_notes: string[];
  references: DoseReference[];
  synergies: CompoundSynergy[];
}

export function CompoundReferenceTab({
  compounds,
  selectedCompoundId,
  onUseInCalculator,
}: {
  compounds: ReferenceCompound[];
  selectedCompoundId?: string;
  onUseInCalculator: (slug: string) => void;
}) {
  // Expand the peptide the user came from (deep link / calculator / detail page),
  // falling back to the first compound when there's no selection.
  const initialOpen =
    selectedCompoundId && compounds.some((c) => c.id === selectedCompoundId)
      ? selectedCompoundId
      : (compounds[0]?.id ?? null);
  const [open, setOpen] = useState<string | null>(initialOpen);
  const openRef = useRef<HTMLDivElement | null>(null);

  // Scroll the came-from compound into view when arriving with a selection.
  useEffect(() => {
    if (selectedCompoundId && openRef.current) {
      openRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <p className="font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Literature dose ranges are <strong className="text-[var(--fg)]">educational reference only</strong> —
        graded by evidence quality and cited. They are a starting point for a clinician discussion,
        not a prescription. Pick a row to prefill the calculator, then override with your own numbers.
      </p>

      {compounds.map((c) => {
        const isOpen = open === c.id;
        return (
          <div
            key={c.id}
            ref={c.id === initialOpen ? openRef : undefined}
            className="scroll-mt-4 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                  {c.name}
                </span>
                <EvidenceBadge
                  level={c.evidence_level as EvidenceLevel}
                  fdaApproved={c.fda_approved}
                />
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[14px] text-[var(--fg-subtle)]">
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen && (
              <div className="space-y-4 border-t border-[var(--border)] px-5 py-4">
                {c.mechanism && (
                  <p className="font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
                    {c.mechanism}
                  </p>
                )}

                {c.references.length === 0 ? (
                  <div className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] p-4 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
                    No literature ranges loaded for this compound yet. Use the calculator with
                    values from you or your clinician.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {c.references.map((ref) => (
                      <li
                        key={ref.id}
                        className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium capitalize text-[var(--fg)]">
                            {ref.context}
                          </span>
                          <div className="flex items-center gap-2">
                            <EvidenceBadge level={ref.evidence_level as EvidenceLevel} />
                            {!ref.is_human_data && (
                              <span className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-1.5 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] uppercase tracking-[0.07em] text-[var(--fg-subtle)]">
                                non-human data
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-[var(--fg)]">
                          <DoseAnnotatedText text={ref.range_display} />
                        </div>

                        {ref.route && (
                          <p className="mt-1 font-[family-name:var(--font-sans)] text-[11px] uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
                            route: {ref.route}
                          </p>
                        )}
                        {ref.notes && (
                          <p className="mt-1 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                            {ref.notes}
                          </p>
                        )}

                        {ref.citation.length > 0 && (
                          <ul className="mt-2 space-y-0.5 font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                            {ref.citation.map((cit, i) => (
                              <li key={i}>
                                {cit.url ? (
                                  <a
                                    href={cit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-[var(--fg)]"
                                  >
                                    {cit.title ?? cit.source ?? cit.url}
                                  </a>
                                ) : (
                                  (cit.title ?? cit.source ?? "source")
                                )}
                                {cit.year ? ` (${cit.year})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}

                        {ref.low_value !== null && (
                          <button
                            type="button"
                            onClick={() => onUseInCalculator(c.slug)}
                            className="mt-3 rounded-[var(--r-sm)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-[11.5px] font-medium text-[var(--primary-bright)] transition-colors hover:bg-[var(--primary-line)]"
                          >
                            Open in calculator
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {c.monitoring_notes.length > 0 && (
                  <div className="font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-muted)]">
                    <p className="font-medium text-[var(--fg)]">Monitoring</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {c.monitoring_notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.synergies.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
                      Commonly combined with
                    </p>
                    <p className="font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.5] text-[var(--fg-subtle)]">
                      Educational pharmacologic rationale only — not a recommended protocol. Any
                      combination should be reviewed with a clinician and checked against your
                      contraindications.
                    </p>
                    <ul className="space-y-2">
                      {c.synergies.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
                              {s.paired_name}
                            </span>
                            <div className="flex items-center gap-2">
                              <EvidenceBadge level={s.evidence_level as EvidenceLevel} />
                              {!s.is_human_data && (
                                <span className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-1.5 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] uppercase tracking-[0.07em] text-[var(--fg-subtle)]">
                                  non-human data
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-muted)]">
                            {s.rationale}
                          </p>
                          {s.caution_notes && (
                            <p className="mt-1 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--danger)]">
                              Caution: {s.caution_notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
