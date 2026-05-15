// Contraindication rules. Detailed rule set lands in Phase 6.
// This stub fixes the import surface so consumers compile against it.

export interface UserHealthSnapshot {
  conditions: string[];
  medications: string[];
  age: number | null;
  pregnant: boolean;
}

export interface ContraindicationFinding {
  compound: string;
  severity: "absolute" | "relative";
  reason: string;
  citations: string[];
}

export function evaluateContraindications(
  _compound: string,
  _snapshot: UserHealthSnapshot,
): ContraindicationFinding[] {
  return [];
}
