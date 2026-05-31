// Structured legal-document format. Plain headings + paragraph arrays so both
// the web (React) and mobile (React Native) can render identical content with no
// markdown dependency. Lines beginning with "• " render as bullets.
export interface LegalSection {
  heading?: string;
  body: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  updated: string; // ISO date
  sections: LegalSection[];
}

// Placeholders to replace with finalized values before publishing (and after a
// lawyer reviews): the operating legal entity, governing jurisdiction, and
// contact addresses. Centralized so they're edited once.
export const LEGAL_ENTITY = "RecompIQ (operated by [Legal Entity Name])";
export const LEGAL_JURISDICTION = "[State / Country]";
export const LEGAL_CONTACT = "legal@recompiq.app";
export const PRIVACY_CONTACT = "privacy@recompiq.app";
export const LEGAL_UPDATED = "2026-05-31";
