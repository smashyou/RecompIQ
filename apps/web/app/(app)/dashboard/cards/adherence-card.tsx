import Link from "next/link";
import { Card, Empty } from "./card";

interface DoseDay {
  date: string;
  taken: number;
  skipped: number;
}

export function AdherenceCard({
  recentDoses,
  hasActiveStack,
}: {
  recentDoses: { taken_at: string; adherence: string }[];
  hasActiveStack: boolean;
}) {
  if (!hasActiveStack) {
    return (
      <Card title="Peptide adherence">
        <Empty>
          No active stack. Create one in{" "}
          <Link href="/peptides/stacks/new" className="underline-offset-2 hover:underline">
            /peptides
          </Link>
          .
        </Empty>
      </Card>
    );
  }

  // 14-day grid of taken vs not.
  const days: DoseDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, taken: 0, skipped: 0 });
  }
  const dayByIso = new Map(days.map((d) => [d.date, d]));
  let totalTaken = 0;
  let totalNotTaken = 0;
  for (const dose of recentDoses) {
    const iso = dose.taken_at.slice(0, 10);
    const day = dayByIso.get(iso);
    if (!day) continue;
    if (dose.adherence === "taken") {
      day.taken++;
      totalTaken++;
    } else {
      day.skipped++;
      totalNotTaken++;
    }
  }
  const total = totalTaken + totalNotTaken;
  const pct = total > 0 ? Math.round((totalTaken / total) * 100) : null;

  return (
    <Card title="Peptide adherence" hint="14d">
      {recentDoses.length === 0 ? (
        <Empty>
          No doses logged yet —{" "}
          <Link href="/peptides/dose-log" className="underline-offset-2 hover:underline">
            log one
          </Link>
          .
        </Empty>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-semibold tabular-nums">
              {pct ?? "—"}
              <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">
                %
              </span>
            </p>
            <p className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {totalTaken}/{total} taken
            </p>
          </div>
          <div className="flex gap-1">
            {days.map((d) => {
              const tone =
                d.taken > 0
                  ? "bg-[var(--color-accent)]"
                  : d.skipped > 0
                    ? "bg-[var(--color-destructive)] opacity-60"
                    : "bg-[var(--color-muted)]";
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.taken} taken, ${d.skipped} skipped`}
                  className={`h-6 flex-1 rounded ${tone}`}
                />
              );
            })}
          </div>
          <Link
            href="/peptides/dose-log"
            className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline"
          >
            See full log →
          </Link>
        </div>
      )}
    </Card>
  );
}
