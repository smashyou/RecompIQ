import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

const MOOD_EMOJI = ["😞", "🙁", "😐", "🙂", "😄"];
const ENERGY_EMOJI = ["🪫", "🔋", "🔋", "🔌", "⚡"];

export function SymptomsCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const s = snapshot.latestSymptom;
  if (!s) {
    return (
      <Card title="Symptoms">
        <Empty>Log mood + energy daily to spot patterns.</Empty>
      </Card>
    );
  }
  const hint = new Date(s.logged_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <Card title="Symptoms" hint={hint}>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Mood</dt>
          <dd className="text-2xl">{s.mood ? MOOD_EMOJI[s.mood - 1] : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Energy</dt>
          <dd className="text-2xl">{s.energy ? ENERGY_EMOJI[s.energy - 1] : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-muted-foreground)]">Pain</dt>
          <dd className="tabular-nums text-lg leading-8">{s.pain ?? "—"}/10</dd>
        </div>
      </dl>
      {s.nausea && (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Nausea reported.</p>
      )}
    </Card>
  );
}
