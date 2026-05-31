import { ShieldAlert } from "lucide-react";

// Wraps any AI- or user-rendered text containing dose mentions. Splits the text
// on the [edu]…[/edu] markers produced by `wrapDoseLike()` and styles those
// chunks with a hover-tooltip badge + class that signals "educational only".
//
// If the text contains no doses, renders plainly.

interface Props {
  text: string;
  // When false, suppress the inline footer (caller renders one shared footer
  // for a list of dose lines instead of one per line).
  showFooter?: boolean;
}

const SEGMENT_PATTERN = /\[edu\]([\s\S]*?)\[\/edu\]/g;

export function DoseAnnotatedText({ text, showFooter = true }: Props) {
  const parts: { kind: "text" | "dose"; value: string }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SEGMENT_PATTERN.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ kind: "text", value: text.slice(lastIndex, m.index) });
    parts.push({ kind: "dose", value: m[1]! });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ kind: "text", value: text.slice(lastIndex) });

  const anyDose = parts.some((p) => p.kind === "dose");

  return (
    <>
      <span className="whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.kind === "dose" ? (
            <span
              key={i}
              className="rounded border border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-1 text-[var(--color-accent)]"
              title="Dose values are educational / research summaries only. Discuss with your clinician."
            >
              {p.value}
            </span>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </span>
      {anyDose && showFooter && <DoseDisclaimerFooter />}
    </>
  );
}

// Footer that goes below messages containing dose mentions.
export function DoseDisclaimerFooter() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-2 text-[10px] leading-relaxed text-[var(--color-muted-foreground)]">
      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        <strong className="text-[var(--color-foreground)]">Educational and research summary only.</strong>{" "}
        Dose values in this message reflect what&apos;s described in the literature or by
        practitioners — they are not medical advice and do not constitute a prescription.
        Discuss any protocol with a licensed clinician before initiation or dose changes.
      </span>
    </div>
  );
}
