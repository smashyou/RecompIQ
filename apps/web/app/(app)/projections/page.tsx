import { buildProjection } from "@peptide/projections";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, MetricBox, Overline, SectionHeader, Stat } from "@/components/kit";
import { AutoGrid } from "@/components/ui/layout";
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
      <div className="flex w-full flex-col gap-[var(--space-grid)]">
        <SectionHeader num="06" title="Projections" />
        <Card>
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            Set a goal in onboarding to see your projection.
          </p>
        </Card>
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
      <div className="flex w-full flex-col gap-[var(--space-grid)]">
        <SectionHeader num="06" title="Projections" />
        <Card>
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            Log a weigh-in to start a projection.
          </p>
        </Card>
      </div>
    );
  }

  const adherence = ADHERENCE_LABEL[projection.adherence]!;
  const toneVar =
    adherence.tone === "good"
      ? { fg: "var(--positive)", line: "var(--positive-line)", wash: "var(--positive-wash)" }
      : adherence.tone === "warn"
        ? { fg: "var(--warn)", line: "var(--warn-line)", wash: "var(--warn-wash)" }
        : { fg: "var(--fg-muted)", line: "var(--border)", wash: "var(--surface-1)" };

  return (
    <div className="flex w-full flex-col gap-[var(--space-grid)]">
      <SectionHeader
        num="06"
        title="Projections"
        note="Three linear trajectories vs. actual + 7-day moving average. Projection, not prediction."
      />

      <div className="flex items-center gap-3">
        <Overline>Adherence</Overline>
        <span
          className="inline-flex items-center rounded-[var(--r-pill)] border px-3 py-1 font-[family-name:var(--font-sans)] text-xs font-medium"
          style={{ borderColor: toneVar.line, background: toneVar.wash, color: toneVar.fg }}
        >
          {adherence.label}
        </span>
      </div>

      <AutoGrid min="240px">
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
      </AutoGrid>

      <Card title="Trajectory" hint="lb over time" pad={16}>
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
      </Card>

      <Card title="How this is built" pad={16}>
        <p className="font-[family-name:var(--font-sans)] text-xs leading-relaxed text-[var(--fg-muted)]">
          Target rate = (start − target midpoint) ÷ timeline weeks. Conservative ≈ 60% of target.
          Aggressive ≈ 115% of target. Lines are linear; real weight loss decelerates as you
          approach the target. Use this for orientation, not absolute prediction.
        </p>
      </Card>
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
    <Card
      pad={18}
      style={
        emphasis
          ? { borderColor: "var(--primary-line)", background: "var(--primary-wash)" }
          : undefined
      }
    >
      <Overline>{label}</Overline>
      <div className="mt-3">
        <Stat value={rate.toFixed(2)} unit="lb/wk" size={26} />
      </div>
      <div className="mt-4">
        <MetricBox
          label="ETA"
          value={etaWeeks !== null ? etaWeeks : "—"}
          unit={etaWeeks !== null ? "weeks" : undefined}
        />
      </div>
      {etaDate && (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-2xs tabular-nums text-[var(--fg-subtle)]">
          {new Date(etaDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </Card>
  );
}
