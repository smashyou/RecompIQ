"use client";

import { useState } from "react";
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
  onUseInCalculator,
}: {
  compounds: ReferenceCompound[];
  onUseInCalculator: (slug: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(compounds[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Literature dose ranges are <strong>educational reference only</strong> — graded by evidence
        quality and cited. They are a starting point for a clinician discussion, not a prescription.
        Pick a row to prefill the calculator, then override with your own numbers.
      </p>

      {compounds.map((c) => {
        const isOpen = open === c.id;
        return (
          <div key={c.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold">{c.name}</span>
                <EvidenceBadge
                  level={c.evidence_level as EvidenceLevel}
                  fdaApproved={c.fda_approved}
                />
              </div>
              <span className="text-xs text-[var(--color-muted-foreground)]">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                {c.mechanism && (
                  <p className="text-sm text-[var(--color-muted-foreground)]">{c.mechanism}</p>
                )}

                {c.references.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted-foreground)]">
                    No literature ranges loaded for this compound yet. Use the calculator with
                    values from you or your clinician.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {c.references.map((ref) => (
                      <li
                        key={ref.id}
                        className="rounded-lg border border-[var(--color-border)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize">{ref.context}</span>
                          <div className="flex items-center gap-2">
                            <EvidenceBadge level={ref.evidence_level as EvidenceLevel} />
                            {!ref.is_human_data && (
                              <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                                non-human data
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-sm">
                          <DoseAnnotatedText text={ref.range_display} />
                        </div>

                        {ref.route && (
                          <p className="mt-1 text-xs uppercase text-[var(--color-muted-foreground)]">
                            route: {ref.route}
                          </p>
                        )}
                        {ref.notes && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{ref.notes}</p>
                        )}

                        {ref.citation.length > 0 && (
                          <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                            {ref.citation.map((cit, i) => (
                              <li key={i}>
                                {cit.url ? (
                                  <a
                                    href={cit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-[var(--color-foreground)]"
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
                            className="mt-3 rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-muted)]"
                          >
                            Open in calculator
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {c.monitoring_notes.length > 0 && (
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    <p className="font-medium text-[var(--color-foreground)]">Monitoring</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {c.monitoring_notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.synergies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Commonly combined with</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      Educational pharmacologic rationale only — not a recommended protocol. Any
                      combination should be reviewed with a clinician and checked against your
                      contraindications.
                    </p>
                    <ul className="space-y-2">
                      {c.synergies.map((s) => (
                        <li key={s.id} className="rounded-lg border border-[var(--color-border)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{s.paired_name}</span>
                            <div className="flex items-center gap-2">
                              <EvidenceBadge level={s.evidence_level as EvidenceLevel} />
                              {!s.is_human_data && (
                                <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                                  non-human data
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{s.rationale}</p>
                          {s.caution_notes && (
                            <p className="mt-1 text-xs text-[var(--color-destructive)]">
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
