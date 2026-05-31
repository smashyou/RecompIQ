import { createContext, useContext, useState, type ReactNode } from "react";

// Single source of truth for the "selected peptide" across the whole Peptides
// section (library → calculator → reference → builder → titration). Keyed by
// slug — each screen resolves slug→id from its own loaded compound list. Lives
// at the peptides stack layout so it persists across pushes within the section.
interface PeptideSelection {
  slug: string | null;
  setSlug: (slug: string | null) => void;
}

const Ctx = createContext<PeptideSelection | undefined>(undefined);

export function PeptideSelectionProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  return <Ctx.Provider value={{ slug, setSlug }}>{children}</Ctx.Provider>;
}

export function usePeptideSelection(): PeptideSelection {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePeptideSelection must be used within PeptideSelectionProvider");
  return v;
}
