import Link from "next/link";
import { Dumbbell, Plus, ScanLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Phase-aware templates + ad-hoc sessions. Walking and mobility count.
          </p>
        </div>
        <div className="flex gap-2">
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
      </header>

      {workouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Dumbbell className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No sessions yet. Start from a template or log freeform.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {workouts.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {w.name ?? w.template_slug ?? `${w.session_type} session`}
                  </p>
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    {w.session_type}
                  </span>
                  {w.phase && (
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      {w.phase}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(w.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {w.duration_min ? ` · ${w.duration_min} min` : ""}
                  {w.perceived_exertion ? ` · RPE ${w.perceived_exertion}` : ""}
                  {w.workout_exercises.length > 0
                    ? ` · ${w.workout_exercises.length} exercises`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
