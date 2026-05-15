// Safety alert rule engine. Implementation lands in Phase 8.

import type { AlertKind, AlertSeverity } from "@peptide/shared";

export interface AlertFinding {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  evidence: Record<string, unknown>;
}

export function scanRecentLogs(_input: Record<string, unknown>): AlertFinding[] {
  return [];
}
