"use client";

import { useMemo, useState } from "react";
import { buildTimelineModel, type TimelineLoad } from "@/lib/queries/timeline";
import { TimelineLanes } from "@/components/timeline/timeline-lanes";
import { Card } from "@/components/kit";

const STORE_KEY = "timeline:hidden";

function readHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

export function TimelineClient({ data }: { data: TimelineLoad }) {
  const model = useMemo(() => buildTimelineModel(data), [data]);
  const [hidden, setHidden] = useState<Set<string>>(readHidden);
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);

  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Readout date for the focused fraction.
  const focusISO = useMemo(() => {
    if (scrubFrac === null) return null;
    const startMs = +new Date(`${model.startISO}T00:00:00`);
    const endMs = +new Date(`${model.endISO}T23:59:59`);
    const ms = startMs + (endMs - startMs) * scrubFrac;
    return new Date(ms).toISOString().slice(0, 10);
  }, [scrubFrac, model.startISO, model.endISO]);

  if (model.lanes.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-[var(--fg-muted)]">
          Nothing logged in this range yet. Log weight, food, doses, or training to see your timeline.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* readout header */}
      <Card>
        <div className="mb-2 font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--fg)]">
          {focusISO
            ? new Date(`${focusISO}T00:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Hover / scrub to read a day"}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {model.lanes
            .filter((l) => !hidden.has(l.key))
            .map((l) => {
              const v = focusISO ? l.readAt(focusISO) : null;
              return (
                <div key={l.key} className="flex items-center justify-between gap-2 text-2xs">
                  <span className="text-[var(--fg-subtle)]">{l.label}</span>
                  <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                    {v ?? "—"}
                  </span>
                </div>
              );
            })}
        </div>
      </Card>

      {/* axis ticks */}
      <div className="flex pl-28">
        {model.ticks.map((t, i) => (
          <span
            key={i}
            className="flex-1 font-[family-name:var(--font-mono)] text-2xs text-[var(--fg-subtle)]"
            style={{ textAlign: i === 0 ? "left" : i === model.ticks.length - 1 ? "right" : "center" }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* lanes — Card has no className prop, so use a plain styled div (documented fallback) */}
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
        <TimelineLanes model={model} hidden={hidden} scrubFrac={scrubFrac} onScrub={setScrubFrac} />
      </div>

      {/* visibility toggles */}
      <div className="flex flex-wrap gap-1.5">
        {model.lanes.map((l) => {
          const off = hidden.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => toggle(l.key)}
              className={`rounded-[var(--r-pill)] border px-2.5 py-1 text-2xs font-medium transition-colors ${
                off
                  ? "border-[var(--border)] bg-transparent text-[var(--fg-subtle)] line-through"
                  : "border-[var(--primary-line)] bg-[var(--primary-wash)] text-[var(--primary-bright)]"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
