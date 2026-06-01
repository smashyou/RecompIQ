"use client";

import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Chip, Overline } from "@/components/kit";
import { AutoGrid } from "@/components/ui/layout";

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
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {PHASES.map((p) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>
            {p}
            {p === userPhase ? " · your phase" : ""}
          </Chip>
        ))}
      </div>

      <AutoGrid min="240px">
        {filtered.map((t) => (
          <Card key={t.slug} style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
                  {t.name}
                </h3>
                <Chip active={t.phase === userPhase}>{t.phase}</Chip>
                <Chip>{t.session_type}</Chip>
              </div>
              <p className="mt-1.5 font-[family-name:var(--font-sans)] text-xs leading-relaxed text-[var(--fg-muted)]">
                {t.description}
              </p>
            </div>
            <ol className="flex-1 space-y-1.5">
              {t.exercises.slice(0, 6).map((ex, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-2xs tabular-nums text-[var(--fg-subtle)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg)]">
                    {ex.name}
                  </span>
                  {(ex.sets && ex.reps) || ex.duration_min ? (
                    <span className="font-[family-name:var(--font-mono)] text-2xs tabular-nums text-[var(--fg-subtle)]">
                      {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ""}
                      {ex.duration_min ? ` ${ex.duration_min} min` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
              {t.exercises.length > 6 && (
                <li>
                  <Overline style={{ fontSize: "var(--text-2xs)" }}>+ {t.exercises.length - 6} more</Overline>
                </li>
              )}
            </ol>
            <Button asChild className="w-full">
              <Link href={`/workouts/new?template=${t.slug}`}>
                <Play className="h-4 w-4" /> Start from this template
              </Link>
            </Button>
          </Card>
        ))}
      </AutoGrid>
    </div>
  );
}
