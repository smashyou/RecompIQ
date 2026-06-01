import { buildProjection } from "@peptide/projections";
import type { DashboardSnapshot } from "@/lib/queries/dashboard";

// Build a calm, factual coach insight from real numbers. No prescriptions —
// observations + a "worth discussing with your clinician" framing only.
export function deriveInsight(snapshot: DashboardSnapshot): string {
  const { goal, weightSeries, latestWeight } = snapshot;

  let trendSentence = "";
  if (goal && latestWeight) {
    const projection = buildProjection({
      weights: weightSeries,
      startWeightLb: goal.start_weight_lb,
      goalWeightLbMin: goal.goal_weight_lb_min,
      goalWeightLbMax: goal.goal_weight_lb_max,
      timelineWeeks: goal.timeline_weeks,
    });
    const trend = projection?.weeklyTrendLb ?? null;
    if (trend !== null && trend > 0) {
      trendSentence = `Your loss rate is running about ${trend.toFixed(1)} lb/wk. `;
    } else if (trend !== null && trend <= 0) {
      trendSentence = `Weight has been flat over the last two weeks. `;
    }
  }

  const proteinMin = goal?.protein_target_g_min ?? null;
  let proteinSentence = "";
  if (proteinMin !== null && snapshot.macrosToday.protein_g > 0) {
    proteinSentence =
      snapshot.macrosToday.protein_g < proteinMin
        ? "Protein is under target today — worth raising before your next clinician visit."
        : "Protein is on target today.";
  }

  const body = `${trendSentence}${proteinSentence}`.trim();
  return (
    body ||
    "Log a few weigh-ins and meals and I'll surface trends here. This is educational tracking, not medical advice."
  );
}
