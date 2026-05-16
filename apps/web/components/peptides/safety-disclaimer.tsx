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
      <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-2 text-[10px] leading-relaxed text-[var(--color-muted-foreground)]">
        Educational tracking only. Not medical advice. Discuss any protocol with a licensed
        clinician.
      </p>
    );
  }
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
      <div className="space-y-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <p>
          <strong className="text-[var(--color-foreground)]">Educational tracking only.</strong>{" "}
          RecompIQ does not prescribe doses, diagnose conditions, or replace medical care. All
          dose values are user- or clinician-supplied.
        </p>
        <p>
          Discuss any peptide protocol with a licensed clinician before starting, changing, or
          discontinuing. Use sterile technique; do not reuse needles; discard questionable vials.
        </p>
      </div>
    </div>
  );
}
