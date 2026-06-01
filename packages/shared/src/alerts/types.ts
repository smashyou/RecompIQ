import type { AlertKind, AlertSeverity, EvidenceLevel } from "../enums";

// ---- engine inputs (platform loaders build this from DB rows) ----
export interface AlertScanInput {
  weights: { logged_at: string; value_lb: number }[];      // ascending
  vitals: { logged_at: string; bp_systolic: number | null; bp_diastolic: number | null; glucose_mgdl: number | null }[]; // descending (latest first)
  proteinByDay: { day: string; protein_g: number }[];      // recent days
  proteinGoalMin: number | null;
  doses: { taken_at: string; adherence: string }[];        // recent window
  metrics: { metric_key: string; value: number; logged_at: string }[]; // self-checks (neuro_severity, nausea_severity…)
  symptoms: { logged_at: string; nausea: boolean | null }[];
  waterByDay: { day: string; ml: number }[];
  activeCompounds: { slug: string; name: string; absolute_contraindications: string[]; relative_contraindications: string[] }[];
  health: { conditions: string[]; medications: string[]; injuries: string[]; age: number | null; sex: string | null };
  now: string; // ISO; passed in (engine stays pure — no Date.now())
}

export interface AlertFinding {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;                     // observation + clinician framing, never an instruction
  evidence: Record<string, unknown>;   // the data that triggered it
  evidenceLevel: EvidenceLevel;
  citation: string;
  fingerprint: string;                 // stable dedup key
}

// ---- rule catalog (values finalized by evidence-researcher, Task 3) ----
export interface AlertRule {
  kind: AlertKind;
  /** numeric cut points; meaning depends on the evaluator (see engine). */
  warnAt?: number;
  criticalAt?: number;
  /** direction: 'high' = value above cut triggers; 'low' = below. */
  direction?: "high" | "low";
  evidenceLevel: EvidenceLevel;
  citation: string;
  /** title + message templates; {v} interpolated with the salient value. */
  title: string;
  messageWarn: string;
  messageCritical?: string;
}
