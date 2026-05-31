import type { LegalDoc } from "./types";
import { TERMS } from "./terms";
import { PRIVACY } from "./privacy";
import { DISCLAIMER } from "./disclaimer";
import { RESEARCH_USE } from "./research-use";

export * from "./types";
export { TERMS, PRIVACY, DISCLAIMER, RESEARCH_USE };

// Ordered for display (hubs, footers, settings).
export const LEGAL_DOCS: LegalDoc[] = [DISCLAIMER, RESEARCH_USE, TERMS, PRIVACY];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
