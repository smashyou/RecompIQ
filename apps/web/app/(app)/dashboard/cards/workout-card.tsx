import Link from "next/link";
import { Card, Empty } from "./card";

interface TodayWorkout {
  id: string;
  name: string | null;
  session_type: string;
  duration_min: number | null;
  perceived_exertion: number | null;
  exerciseCount: number;
}

export function WorkoutCard({
  todayWorkout,
  suggestion,
}: {
  todayWorkout: TodayWorkout | null;
  suggestion: { slug: string; name: string; phase: string; session_type: string } | null;
}) {
  if (todayWorkout) {
    return (
      <Card title="Today's workout" hint={todayWorkout.session_type}>
        <div className="space-y-2">
          <p className="text-sm font-medium">{todayWorkout.name ?? "Session"}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {todayWorkout.exerciseCount} exercises
            {todayWorkout.duration_min ? ` · ${todayWorkout.duration_min} min` : ""}
            {todayWorkout.perceived_exertion ? ` · RPE ${todayWorkout.perceived_exertion}` : ""}
          </p>
          <Link
            href="/workouts"
            className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline"
          >
            View all sessions →
          </Link>
        </div>
      </Card>
    );
  }

  if (!suggestion) {
    return (
      <Card title="Today's workout">
        <Empty>
          No phase-appropriate template found.{" "}
          <Link href="/workouts/new" className="underline-offset-2 hover:underline">
            Log freeform
          </Link>
          .
        </Empty>
      </Card>
    );
  }

  return (
    <Card title="Today's workout" hint={`Suggested · ${suggestion.phase}`}>
      <div className="space-y-2">
        <p className="text-sm font-medium">{suggestion.name}</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {suggestion.session_type} · matches your current phase
        </p>
        <Link
          href={`/workouts/new?template=${suggestion.slug}`}
          className="inline-flex rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-muted)]"
        >
          Start session →
        </Link>
      </div>
    </Card>
  );
}
