"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PeptideDrawer } from "@/components/regimen/peptide-drawer";

// Inline "+ Add peptide" entry from the dashboard — no page hop (PRD §5.1).
export function DashboardAddPeptide({
  conditions,
  medications,
}: {
  conditions: string[];
  medications: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-[12px] font-medium text-[var(--primary-bright)] transition-colors hover:bg-[var(--primary-line)]"
      >
        <Plus size={14} /> Add peptide
      </button>
      <PeptideDrawer
        open={open}
        mode="add"
        conditions={conditions}
        medications={medications}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}
