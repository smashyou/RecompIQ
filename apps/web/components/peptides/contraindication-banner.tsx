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
          icon={<AlertCircle size={16} className="text-[var(--danger)]" />}
          tone="destructive"
          title={`Absolute contraindication${absolute.length > 1 ? "s" : ""}`}
          findings={absolute}
        />
      )}
      {relative.length > 0 && (
        <Block
          icon={<AlertTriangle size={16} className="text-[var(--warn)]" />}
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
      className={`rounded-[var(--r-md)] border p-4 font-[family-name:var(--font-sans)] ${
        tone === "destructive"
          ? "border-[var(--danger-line)] bg-[var(--danger-wash)]"
          : "border-[var(--warn-line)] bg-[var(--warn-wash)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <p
          className={`text-[13.5px] font-semibold ${
            tone === "destructive" ? "text-[var(--danger-bright)]" : "text-[var(--fg)]"
          }`}
        >
          {title}
        </p>
      </div>
      <ul className="mt-2 space-y-1 text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
        {findings.map((f, i) => (
          <li key={i}>
            <span className="font-semibold text-[var(--fg)]">{f.compoundName}</span> — {f.reason}{" "}
            <span className="opacity-70">(matched: {f.matchedAgainst})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
