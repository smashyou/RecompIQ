// Weight projection engine. Implementation lands in Phase 5.
// Designed as pure functions so it can be unit-tested without any IO.

export interface ProjectionInput {
  startWeightLb: number;
  goalWeightLbMin: number;
  goalWeightLbMax: number;
  timelineWeeks: number;
  conservativeLossLbPerWeek?: number;
  targetLossLbPerWeek?: number;
  aggressiveLossLbPerWeek?: number;
}

export interface ProjectionPoint {
  weekIndex: number;
  conservativeLb: number;
  targetLb: number;
  aggressiveLb: number;
}

export interface ProjectionResult {
  series: ProjectionPoint[];
  etaWeeksConservative: number;
  etaWeeksTarget: number;
  etaWeeksAggressive: number;
}

export function projectWeight(_: ProjectionInput): ProjectionResult {
  throw new Error("projectWeight: not implemented yet (Phase 5)");
}
