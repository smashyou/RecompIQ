"use client";

import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  duration_min?: number;
  notes?: string;
}

interface Template {
  slug: string;
  name: string;
  phase: string;
  session_type: string;
  description: string;
  exercises: Exercise[];
}

const PHASES = ["P1", "P2", "P3"] as const;

export function TemplatesList({
  templates,
  userPhase,
}: {
  templates: Template[];
  userPhase: string;
}) {
  const [filter, setFilter] = useState<string>(userPhase);
  const filtered = templates.filter((t) => filter === "all" || t.phase === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {PHASES.map((p) => (
          <FilterChip
            key={p}
            active={filter === p}
            onClick={() => setFilter(p)}
            label={`${p}${p === userPhase ? " · your phase" : ""}`}
          />
        ))}
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {filtered.map((t) => (
          <li
            key={t.slug}
            className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {t.phase}
                </span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {t.session_type}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{t.description}</p>
            </div>
            <ol className="space-y-1 text-xs">
              {t.exercises.slice(0, 6).map((ex, i) => (
                <li key={i} className="text-[var(--color-muted-foreground)]">
                  <span className="font-medium text-[var(--color-foreground)]">{ex.name}</span>
                  {ex.sets && ex.reps ? ` · ${ex.sets}×${ex.reps}` : ""}
                  {ex.duration_min ? ` · ${ex.duration_min} min` : ""}
                  {ex.notes ? ` · ${ex.notes}` : ""}
                </li>
              ))}
              {t.exercises.length > 6 && (
                <li className="text-[10px] text-[var(--color-muted-foreground)]">
                  + {t.exercises.length - 6} more…
                </li>
              )}
            </ol>
            <Button asChild className="w-full">
              <Link href={`/workouts/new?template=${t.slug}`}>
                <Play className="h-4 w-4" /> Start from this template
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
          : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
