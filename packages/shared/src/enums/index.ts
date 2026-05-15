export const SEX = ["male", "female", "intersex", "prefer_not_to_say"] as const;
export type Sex = (typeof SEX)[number];

export const GOAL_PHASE = ["P1", "P2", "P3", "plateau", "maintenance"] as const;
export type GoalPhase = (typeof GOAL_PHASE)[number];

export const UNIT_WEIGHT = ["lb", "kg"] as const;
export type UnitWeight = (typeof UNIT_WEIGHT)[number];

export const UNIT_LENGTH = ["in", "cm"] as const;
export type UnitLength = (typeof UNIT_LENGTH)[number];

export const EVIDENCE_LEVEL = [
  "FDA_APPROVED",
  "HUMAN_RCT",
  "HUMAN_OBS",
  "ANIMAL",
  "MECHANISTIC",
  "ANECDOTAL",
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVEL)[number];

export const ROUTE = ["sc", "im", "iv", "oral", "nasal", "topical", "other"] as const;
export type Route = (typeof ROUTE)[number];

export const ADHERENCE = ["taken", "skipped", "partial", "unknown"] as const;
export type Adherence = (typeof ADHERENCE)[number];

export const ALERT_SEVERITY = ["info", "warn", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITY)[number];

export const ALERT_KIND = [
  "rapid_weight_loss",
  "low_protein",
  "severe_nausea",
  "dehydration",
  "glucose_high",
  "glucose_low",
  "bp_high",
  "bp_low",
  "neuro_worsening",
  "side_effect_cluster",
  "unsafe_stack",
  "adherence_drop",
] as const;
export type AlertKind = (typeof ALERT_KIND)[number];

export const VISION_PROVIDER = ["openai", "google", "anthropic"] as const;
export type VisionProvider = (typeof VISION_PROVIDER)[number];

export const LOG_SOURCE = ["manual", "photo", "barcode", "api", "imported"] as const;
export type LogSource = (typeof LOG_SOURCE)[number];
