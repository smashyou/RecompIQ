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

const TONE: Record<EvidenceLevel, string> = {
  FDA_APPROVED: "border-[var(--color-accent)] text-[var(--color-accent)]",
  HUMAN_RCT: "border-[var(--color-accent)] text-[var(--color-accent)]",
  HUMAN_OBS: "border-[var(--color-primary)] text-[var(--color-primary)]",
  ANIMAL: "border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]",
  MECHANISTIC: "border-[var(--color-muted-foreground)] text-[var(--color-muted-foreground)]",
  ANECDOTAL: "border-[var(--color-destructive)] text-[var(--color-destructive)]",
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
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TONE[level],
        className,
      )}
    >
      {display}
    </span>
  );
}
