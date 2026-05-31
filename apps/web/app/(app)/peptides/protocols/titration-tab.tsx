"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useFireToast } from "@/components/ui/toast";

interface ScheduleWeek {
  id: string;
  week_number: number;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  compounds: { slug: string; name: string } | null;
}

export interface ProtocolSchedule {
  id: string;
  name: string;
  phase: string | null;
  start_on: string | null;
  is_active: boolean;
  protocol_schedule_weeks: ScheduleWeek[];
}

export function TitrationTab({ schedules }: { schedules: ProtocolSchedule[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/protocols/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.status === 401) {
      router.replace("/signin?next=/peptides/protocols");
      return;
    }
    if (!res.ok) {
      toast.error("Could not delete");
      return;
    }
    toast.success("Protocol deleted");
    router.refresh();
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-8 text-center">
        <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-subtle)]">
          No titration schedules yet. Build one in the{" "}
          <strong className="text-[var(--fg)]">Protocol Builder</strong> tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {schedules.map((s) => {
        const byWeek = [...s.protocol_schedule_weeks].sort((a, b) => a.week_number - b.week_number);
        return (
          <div key={s.id} className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                  {s.name}
                </h3>
                <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                  {s.phase ? `${s.phase} · ` : ""}
                  {byWeek.length} week{byWeek.length === 1 ? "" : "s"}
                  {s.start_on ? ` · starts ${s.start_on}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                disabled={deleting === s.id}
                className="rounded-[var(--r-sm)] border border-[var(--border)] p-2 text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]"
                aria-label="Delete protocol"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full font-[family-name:var(--font-sans)] text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    {["Week", "Compound", "Dose", "Frequency", "Route"].map((h) => (
                      <th
                        key={h}
                        className="py-2 pr-3 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)] last:pr-0"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byWeek.map((w) => (
                    <tr key={w.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                        {w.week_number}
                      </td>
                      <td className="py-2 pr-3 text-[var(--fg)]">{w.compounds?.name ?? "—"}</td>
                      <td className="py-2 pr-3 font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                        {w.dose_value} {w.dose_unit}
                      </td>
                      <td className="py-2 pr-3 text-[var(--fg-muted)]">{w.frequency}</td>
                      <td className="py-2 uppercase text-[var(--fg-subtle)]">{w.route}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
