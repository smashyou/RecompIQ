import Link from "next/link";
import { Dumbbell, Plus, ScanLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, Chip, Overline, SectionHeader } from "@/components/kit";

export const dynamic = "force-dynamic";

interface WorkoutRow {
  id: string;
  session_type: string;
  phase: string | null;
  date: string;
  duration_min: number | null;
  template_slug: string | null;
  name: string | null;
  perceived_exertion: number | null;
  workout_exercises: { name: string }[];
}

export default async function WorkoutsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workouts")
    .select("id,session_type,phase,date,duration_min,template_slug,name,perceived_exertion, workout_exercises(name)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(30);
  const workouts = (data ?? []) as unknown as WorkoutRow[];

  return (
    <div className="flex w-full flex-col gap-[var(--space-grid)]">
      <SectionHeader
        num="09"
        title="Workouts"
        note="Phase-aware templates + ad-hoc sessions. Walking and mobility count."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/workouts/templates">
            <ScanLine className="h-4 w-4" /> Templates
          </Link>
        </Button>
        <Button asChild>
          <Link href="/workouts/new">
            <Plus className="h-4 w-4" /> New session
          </Link>
        </Button>
      </div>

      {workouts.length === 0 ? (
        <Card
          style={{
            borderStyle: "dashed",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: 40,
            gap: 12,
          }}
        >
          <Dumbbell size={28} style={{ color: "var(--fg-subtle)" }} />
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            No sessions yet. Start from a template or log freeform.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {workouts.map((w) => (
            <Card key={w.id} pad={16}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
                      {w.name ?? w.template_slug ?? `${w.session_type} session`}
                    </span>
                    <Chip>{w.session_type}</Chip>
                    {w.phase && <Chip>{w.phase}</Chip>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                      {new Date(w.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {w.duration_min ? (
                      <Metric value={w.duration_min} unit="min" />
                    ) : null}
                    {w.perceived_exertion ? (
                      <Metric label="RPE" value={w.perceived_exertion} />
                    ) : null}
                    {w.workout_exercises.length > 0 ? (
                      <Metric value={w.workout_exercises.length} unit="ex" />
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ value, unit, label }: { value: number | string; unit?: string; label?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      {label && <Overline style={{ fontSize: "var(--text-2xs)", letterSpacing: "0.08em" }}>{label}</Overline>}
      <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg)]">
        {value}
      </span>
      {unit && <span className="font-[family-name:var(--font-mono)] text-2xs text-[var(--fg-subtle)]">{unit}</span>}
    </span>
  );
}
