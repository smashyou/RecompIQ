import { AlertTriangle, AlertCircle } from "lucide-react";
import type { ContraindicationFinding } from "@peptide/peptides";

export function ContraindicationBanner({
  findings,
}: {
  findings: ContraindicationFinding[];
}) {
  if (findings.length === 0) return null;
  const absolute = findings.filter((f) => f.severity === "absolute");
  const relative = findings.filter((f) => f.severity === "relative");

  return (
    <div className="space-y-3">
      {absolute.length > 0 && (
        <Block
          icon={<AlertCircle className="h-4 w-4 text-[var(--color-destructive)]" />}
          tone="destructive"
          title={`Absolute contraindication${absolute.length > 1 ? "s" : ""}`}
          findings={absolute}
        />
      )}
      {relative.length > 0 && (
        <Block
          icon={<AlertTriangle className="h-4 w-4" style={{ color: "oklch(0.78 0.18 70)" }} />}
          tone="warn"
          title={`Relative contraindication${relative.length > 1 ? "s" : ""} — discuss with your clinician`}
          findings={relative}
        />
      )}
    </div>
  );
}

function Block({
  icon,
  tone,
  title,
  findings,
}: {
  icon: React.ReactNode;
  tone: "destructive" | "warn";
  title: string;
  findings: ContraindicationFinding[];
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "destructive"
          ? "border-[var(--color-destructive)] bg-[var(--color-destructive)]/5"
          : "border-[var(--color-border)] bg-[var(--color-muted)]"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p
          className={`text-sm font-medium ${
            tone === "destructive" ? "text-[var(--color-destructive)]" : ""
          }`}
        >
          {title}
        </p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted-foreground)]">
        {findings.map((f, i) => (
          <li key={i}>
            <span className="font-medium text-[var(--color-foreground)]">{f.compoundName}</span>{" "}
            — {f.reason} <span className="opacity-70">(matched: {f.matchedAgainst})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
