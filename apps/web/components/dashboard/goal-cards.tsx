"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { Card, Overline } from "@/components/kit";
import type { GoalCard } from "@/lib/queries/goal-cards";

function Trend({ perWeek, higherIsBetter, unit }: { perWeek: number | null; higherIsBetter: boolean; unit: string }) {
  if (perWeek === null || perWeek === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--fg-subtle)]">
        <Minus size={13} /> flat
      </span>
    );
  }
  const improving = higherIsBetter ? perWeek > 0 : perWeek < 0;
  const Icon = perWeek > 0 ? ArrowUpRight : ArrowDownRight;
  const color = improving ? "var(--primary-bright)" : "var(--warn)";
  return (
    <span className="inline-flex items-center gap-1" style={{ color }}>
      <Icon size={13} />
      {Math.abs(perWeek)}
      {unit.startsWith("/") ? "" : ` ${unit}`}/wk
    </span>
  );
}

export function GoalCards({ cards }: { cards: GoalCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          Goal progress
        </h2>
        <Link href="/goals" className="font-[family-name:var(--font-sans)] text-[12px] text-[var(--primary)] hover:underline">
          edit goals
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.goalKey}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <Overline style={{ fontSize: 9 }}>{c.goalLabel}</Overline>
                <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
                  {c.metricLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--font-mono)] text-[20px] font-semibold tabular-nums text-[var(--fg)]">
                  {c.current ?? "—"}
                  <span className="ml-1 text-[11px] text-[var(--fg-subtle)]">{c.unit}</span>
                </p>
                <p className="font-[family-name:var(--font-sans)] text-[11px] tabular-nums">
                  <Trend perWeek={c.observedPerWeek} higherIsBetter={c.higherIsBetter} unit={c.unit} />
                </p>
              </div>
            </div>

            {c.points.length >= 2 ? (
              <div className="mt-2 h-[40px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={c.points.map((p, i) => ({ i, v: p.value }))}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="var(--viz-actual, var(--primary))"
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-2 font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                <Link href="/log?tab=goals" className="text-[var(--primary)] underline">
                  Log a check-in
                </Link>{" "}
                to start tracking.
              </p>
            )}

            {c.projection && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-muted)]">
                    Illustrative: ~{c.projection.targetValue}
                    {c.unit} by ~{c.projection.weeks} wks
                  </span>
                  <EvidenceBadge level={c.projection.evidenceLevel as never} fdaApproved={false} />
                </div>
                <p className="mt-1 font-[family-name:var(--font-sans)] text-[10px] leading-[1.4] text-[var(--fg-subtle)]">
                  Illustrative — not a predicted outcome. {c.projection.caveat} Discuss with your clinician.
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
