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
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No titration schedules yet. Build one in the <strong>Protocol Builder</strong> tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {schedules.map((s) => {
        const byWeek = [...s.protocol_schedule_weeks].sort((a, b) => a.week_number - b.week_number);
        return (
          <div key={s.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {s.phase ? `${s.phase} · ` : ""}
                  {byWeek.length} week{byWeek.length === 1 ? "" : "s"}
                  {s.start_on ? ` · starts ${s.start_on}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                disabled={deleting === s.id}
                className="rounded-md border border-[var(--color-border)] p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                aria-label="Delete protocol"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="py-2 pr-3 font-medium">Week</th>
                    <th className="py-2 pr-3 font-medium">Compound</th>
                    <th className="py-2 pr-3 font-medium">Dose</th>
                    <th className="py-2 pr-3 font-medium">Frequency</th>
                    <th className="py-2 font-medium">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {byWeek.map((w) => (
                    <tr key={w.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 pr-3 tabular-nums">{w.week_number}</td>
                      <td className="py-2 pr-3">{w.compounds?.name ?? "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {w.dose_value} {w.dose_unit}
                      </td>
                      <td className="py-2 pr-3">{w.frequency}</td>
                      <td className="py-2 uppercase text-[var(--color-muted-foreground)]">{w.route}</td>
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
