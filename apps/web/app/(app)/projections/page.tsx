import { buildProjection } from "@peptide/projections";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProjectionChart } from "./projection-chart";

export const dynamic = "force-dynamic";

const ADHERENCE_LABEL: Record<string, { label: string; tone: "good" | "warn" | "neutral" }> = {
  ahead: { label: "Ahead of target", tone: "good" },
  "on-target": { label: "On target", tone: "good" },
  behind: { label: "Behind pace", tone: "warn" },
  stalled: { label: "Stalled — review intake / sleep", tone: "warn" },
  "insufficient-data": { label: "Need more weigh-ins", tone: "neutral" },
};

export default async function ProjectionsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [goalRes, weightsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("start_weight_lb,goal_weight_lb_min,goal_weight_lb_max,timeline_weeks")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true }),
  ]);

  const goal = goalRes.data;
  const weights = (weightsRes.data ?? []).map((w) => ({
    logged_at: w.logged_at as string,
    value_lb: Number(w.value_lb),
  }));

  if (!goal) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projections</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Set a goal in onboarding to see your projection.
        </p>
      </div>
    );
  }

  const projection = buildProjection({
    weights,
    startWeightLb: Number(goal.start_weight_lb),
    goalWeightLbMin: Number(goal.goal_weight_lb_min),
    goalWeightLbMax: Number(goal.goal_weight_lb_max),
    timelineWeeks: goal.timeline_weeks,
  });

  if (!projection) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projections</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Log a weigh-in to start a projection.
        </p>
      </div>
    );
  }

  const adherence = ADHERENCE_LABEL[projection.adherence]!;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projections</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Three linear trajectories vs. your actual data + 7-day moving average. Projection, not
            prediction — bodies don&apos;t do exact.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            adherence.tone === "good"
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : adherence.tone === "warn"
                ? "border-[var(--color-destructive)] text-[var(--color-destructive)]"
                : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"
          }`}
        >
          {adherence.label}
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <RateCard
          label="Conservative"
          rate={projection.series.conservative.lbsPerWeek}
          etaWeeks={projection.series.conservative.etaWeeks}
          etaDate={projection.series.conservative.etaDate}
        />
        <RateCard
          label="Target"
          rate={projection.series.target.lbsPerWeek}
          etaWeeks={projection.series.target.etaWeeks}
          etaDate={projection.series.target.etaDate}
          emphasis
        />
        <RateCard
          label="Aggressive"
          rate={projection.series.aggressive.lbsPerWeek}
          etaWeeks={projection.series.aggressive.etaWeeks}
          etaDate={projection.series.aggressive.etaDate}
        />
      </section>

      <ProjectionChart
        actual={weights}
        ma={projection.sevenDayMA}
        conservative={projection.series.conservative.points}
        target={projection.series.target.points}
        aggressive={projection.series.aggressive.points}
        targetMinLb={projection.targetMinLb}
        targetMaxLb={projection.targetMaxLb}
        currentLb={projection.currentWeightLb}
      />

      <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <strong className="text-[var(--color-foreground)]">How this is built.</strong> Target rate
        = (start − target midpoint) ÷ timeline weeks. Conservative ≈ 60% of target. Aggressive ≈
        115% of target. Lines are linear; real weight loss decelerates as you approach the target.
        Use this for orientation, not absolute prediction.
      </p>
    </div>
  );
}

function RateCard({
  label,
  rate,
  etaWeeks,
  etaDate,
  emphasis,
}: {
  label: string;
  rate: number;
  etaWeeks: number | null;
  etaDate: string | null;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        emphasis
          ? "border-[var(--color-primary)] bg-[var(--color-card)]"
          : "border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {rate.toFixed(2)}
        <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
          lb/wk
        </span>
      </p>
      <p className="mt-2 text-sm">
        ETA{" "}
        <span className="font-medium tabular-nums">
          {etaWeeks !== null ? `${etaWeeks} weeks` : "—"}
        </span>
      </p>
      {etaDate && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {new Date(etaDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}
