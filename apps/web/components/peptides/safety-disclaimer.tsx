import { ShieldAlert } from "lucide-react";

// Standard disclaimer that must accompany every peptide dose / stack render.
// Keep wording verbatim across the app — never paraphrase per-page.
export function SafetyDisclaimer({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-[9px] rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-[9px] font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.4] text-[var(--fg-subtle)]">
        <ShieldAlert size={14} strokeWidth={1.8} className="shrink-0 text-[var(--fg-subtle)]" />
        Educational tracking only. Not medical advice. Discuss any protocol with a licensed
        clinician.
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-[var(--r-md)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-4 py-[14px]">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] border border-[var(--primary-line)] bg-[var(--surface-1)]">
        <ShieldAlert size={16} className="text-[var(--primary)]" />
      </span>
      <div className="font-[family-name:var(--font-sans)]">
        <strong className="text-[13.5px] font-semibold text-[var(--fg)]">
          Educational tracking only.
        </strong>{" "}
        <span className="text-[12.5px] leading-[1.55] text-[var(--fg-muted)]">
          RecompIQ does not prescribe doses, diagnose conditions, or replace medical care. All
          dose values are user- or clinician-supplied. Discuss any peptide protocol with a
          licensed clinician before starting, changing, or discontinuing. Use sterile technique;
          do not reuse needles; discard questionable vials.
        </span>
      </div>
    </div>
  );
}
