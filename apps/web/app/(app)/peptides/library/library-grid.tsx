"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
import { cn } from "@/lib/cn";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search compounds…"
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                cat === c
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]",
              )}
            >
              {c === "all" ? "All" : c === "blends" ? "Blends" : categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">{filtered.length} shown</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.slug}
            href={`/peptides/library/${c.slug}`}
            className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-primary)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                {c.is_blend && (
                  <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary-foreground)]">
                    Blend
                  </span>
                )}
                <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {categoryLabel(c.category)}
                </span>
              </span>
              <EvidenceBadge level={c.evidence_level as EvidenceLevel} fdaApproved={c.fda_approved} />
            </div>
            <h3 className="mt-2 text-sm font-semibold group-hover:text-[var(--color-primary)]">{c.name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-muted-foreground)]">
              {c.is_blend ? (
                <span>{c.component_count} peptides</span>
              ) : (
                <>
                  {c.typical_route && <span className="uppercase">{c.typical_route}</span>}
                  {c.dose !== "—" && <span className="tabular-nums">{c.dose}</span>}
                  {c.frequency !== "—" && <span>{c.frequency}</span>}
                </>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{c.blurb}</p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
          No compounds match.
        </div>
      )}
    </div>
  );
}
