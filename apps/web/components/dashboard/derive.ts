import { buildProjection } from "@peptide/projections";
import type { DashboardSnapshot } from "@/lib/queries/dashboard";

export interface DashboardAlert {
  label: string;
  detail: string;
}

// Lightweight, data-derived alerts for the banner. The full Phase-8 rule
// engine (packages/peptides/alerts.ts) is still a stub returning []; until it
// lands we surface only the unambiguous, real signals already in the snapshot.
export function deriveAlerts(snapshot: DashboardSnapshot): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const v = snapshot.latestVital;

  if (v?.bp_systolic != null && v.bp_diastolic != null) {
    if (v.bp_systolic >= 140 || v.bp_diastolic >= 90) {
      alerts.push({
        label: "Blood pressure elevated",
        detail: `Last reading ${v.bp_systolic}/${v.bp_diastolic} mmHg — discuss with your clinician`,
      });
    }
  }
  if (v?.glucose_mgdl != null && v.glucose_mgdl >= 126) {
    alerts.push({
      label: "Fasting glucose high",
      detail: `Last reading ${v.glucose_mgdl.toFixed(0)} mg/dL`,
    });
  }

  // Protein under target across logged days in the recent window.
  const proteinMin = snapshot.goal?.protein_target_g_min ?? null;
  if (proteinMin !== null && snapshot.macrosToday.protein_g > 0) {
    if (snapshot.macrosToday.protein_g < proteinMin) {
      alerts.push({
        label: "Protein under target",
        detail: `${Math.round(snapshot.macrosToday.protein_g)}g logged today vs ${proteinMin}g target`,
      });
    }
  }

  return alerts;
}

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
