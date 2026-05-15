import { SafetyBlockedError } from "@peptide/shared";
import type { EvidenceLevel } from "@peptide/shared";

export interface DoseDisplay {
  compound: string;
  doseValue: number;
  doseUnit: "mg" | "mcg" | "iu" | "ml" | "units";
  route: string;
  evidenceLevel: EvidenceLevel;
  source: "user" | "clinician";
  disclaimer: string;
  contraindications: string[];
}

export const CLINICIAN_DISCLAIMER =
  "Educational tracking only. Not medical advice. This app does not prescribe doses. " +
  "Discuss all peptide protocols with a licensed clinician before initiation, dose changes, or discontinuation.";

// Wrap any user-facing dose render so it carries the disclaimer + evidence
// + contraindication metadata. Any code path that emits a dose without
// passing through this helper is a safety violation.
export function safeDoseDisplay(input: {
  compound: string;
  doseValue: number;
  doseUnit: DoseDisplay["doseUnit"];
  route: string;
  evidenceLevel: EvidenceLevel;
  source: DoseDisplay["source"];
  contraindications: string[];
}): DoseDisplay {
  if (input.doseValue <= 0) {
    throw new SafetyBlockedError("Dose value must be > 0");
  }
  return {
    ...input,
    disclaimer: CLINICIAN_DISCLAIMER,
  };
}

// Hard guard: AI-generated text must not emit numeric doses. This is a defense
// in depth — the upstream system prompt already forbids it.
const DOSE_PATTERN =
  /\b\d+(\.\d+)?\s?(mg|mcg|μg|iu|units|ml)\b.*\b(daily|weekly|per\s+day|twice\s+a\s+day|bid|qd|qhs)\b/i;

export function rejectIfDoseLike(text: string, context: string): void {
  if (DOSE_PATTERN.test(text)) {
    throw new SafetyBlockedError(
      `AI output appears to contain a dose recommendation (context: ${context}). Blocked.`,
    );
  }
}
