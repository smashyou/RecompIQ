"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { Chip } from "@/components/kit";
import { categoryLabel } from "@/lib/dose-display";

export interface LibraryCard {
  slug: string;
  name: string;
  category: string;
  evidence_level: string;
  fda_approved: boolean;
  typical_route: string | null;
  blurb: string;
  dose: string;
  frequency: string;
  is_blend: boolean;
  component_count: number;
}

const CATEGORIES = ["all", "blends", "incretin", "growth_factor", "tissue_repair", "metabolic", "longevity", "other"] as const;

export function LibraryGrid({ cards }: { cards: LibraryCard[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (cat === "blends" && !c.is_blend) return false;
      if (cat !== "all" && cat !== "blends" && c.category !== cat) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || c.blurb.toLowerCase().includes(needle);
    });
  }, [cards, q, cat]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search compounds…"
            className="h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-line)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c === "all" ? "All" : c === "blends" ? "Blends" : categoryLabel(c)}
            </Chip>
          ))}
        </div>
      </div>

      <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
        {filtered.length} shown
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.slug}
            href={`/peptides/library/${c.slug}`}
            className="group flex flex-col rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--primary-line)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                {c.is_blend && (
                  <span className="rounded-[var(--r-pill)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-bright)]">
                    Blend
                  </span>
                )}
                <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                  {categoryLabel(c.category)}
                </span>
              </span>
              <EvidenceBadge level={c.evidence_level as EvidenceLevel} fdaApproved={c.fda_approved} />
            </div>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)] group-hover:text-[var(--primary)]">
              {c.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--fg-subtle)]">
              {c.is_blend ? (
                <span>{c.component_count} peptides</span>
              ) : (
                <>
                  {c.typical_route && <span className="uppercase">{c.typical_route}</span>}
                  {c.dose !== "—" && <span>{c.dose}</span>}
                  {c.frequency !== "—" && <span>{c.frequency}</span>}
                </>
              )}
            </div>
            <p className="mt-2 line-clamp-2 font-[family-name:var(--font-sans)] text-[12px] leading-[1.5] text-[var(--fg-muted)]">
              {c.blurb}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 font-[family-name:var(--font-sans)] text-[11px] font-medium text-[var(--fg-subtle)] group-hover:text-[var(--primary)]">
              View detail
              <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border)] p-8 text-center font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-subtle)]">
          No compounds match.
        </div>
      )}
    </div>
  );
}
