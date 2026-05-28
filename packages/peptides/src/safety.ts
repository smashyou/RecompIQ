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

// Standard disclaimer that must accompany every peptide dose / framework view.
// Wording is intentionally consistent across UI surfaces. Update both this and the
// <SafetyDisclaimer> + <DoseDisclaimer> components together if you change it.
export const CLINICIAN_DISCLAIMER =
  "Educational tracking and research summary only. Not medical advice. " +
  "All dose values are user- or clinician-supplied; RecompIQ does not prescribe. " +
  "Discuss any peptide protocol with a licensed clinician before initiation, dose changes, or discontinuation.";

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

// Pattern for dose-like content in free-form AI output.
// Matches things like "6 mg weekly", "300 mcg/day", "2 mL IM 2x per week".
// Intentionally permissive — false positives just trigger an extra disclaimer wrap.
const DOSE_PATTERN =
  /(\d+(?:\.\d+)?)\s?(mg|mcg|μg|iu|units|ml|cc)\b/gi;

// Phase-9b loosened safety: instead of BLOCKING AI text that contains doses
// (the old rejectIfDoseLike behavior), we WRAP each dose mention with [edu]…[/edu]
// tags. The renderer converts those tags to a styled span with the educational
// disclaimer. Callers should then ensure the surrounding message also carries a
// <DoseDisclaimer /> footer.
//
// Returns { wrappedText, doseHits } so callers can decide whether to attach the
// disclaimer footer (any hits > 0 → yes).
export function wrapDoseLike(text: string): { wrappedText: string; doseHits: number } {
  let doseHits = 0;
  const wrappedText = text.replace(DOSE_PATTERN, (match) => {
    doseHits++;
    return `[edu]${match}[/edu]`;
  });
  return { wrappedText, doseHits };
}

// Legacy alias retained for backwards compatibility — but now non-blocking.
// Deprecated: callers should use wrapDoseLike instead.
export function rejectIfDoseLike(text: string, _context: string): void {
  // No-op in Phase 9b. The renderer handles dose framing. We intentionally
  // do NOT throw here anymore so previously-guarded paths don't error.
  void text;
}
