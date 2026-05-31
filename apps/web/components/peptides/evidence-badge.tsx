import { cn } from "@/lib/cn";
import type { EvidenceLevel } from "@peptide/shared";

const LABEL: Record<EvidenceLevel, string> = {
  FDA_APPROVED: "FDA approved",
  HUMAN_RCT: "Human RCT",
  HUMAN_OBS: "Human observational",
  ANIMAL: "Animal only",
  MECHANISTIC: "Mechanistic",
  ANECDOTAL: "Anecdotal",
};

const EV_COLOR: Record<EvidenceLevel, string> = {
  FDA_APPROVED: "var(--ev-fda)",
  HUMAN_RCT: "var(--ev-rct)",
  HUMAN_OBS: "var(--ev-obs)",
  ANIMAL: "var(--ev-animal)",
  MECHANISTIC: "var(--ev-mech)",
  ANECDOTAL: "var(--ev-anecdotal)",
};

export function EvidenceBadge({
  level,
  fdaApproved,
  className,
}: {
  level: EvidenceLevel;
  fdaApproved?: boolean;
  className?: string;
}) {
  const display = fdaApproved && level === "FDA_APPROVED" ? "FDA approved" : LABEL[level];
  const color = EV_COLOR[level];
  return (
    <span
      style={{ borderColor: color, color }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--r-pill)] border px-[9px] py-[3px] font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.07em]",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {display}
    </span>
  );
}
