import { ShieldAlert } from "lucide-react";
import { parseMarkdown, hasEduDose, type MdBlock, type MdInline } from "@peptide/shared";

// Renders AI-coach / dose text as light markdown (bold, italics, code, links,
// lists, headings) while keeping the [edu]…[/edu] dose spans highlighted and
// appending the educational-only disclaimer footer when a dose is present.
// Parsing is our own limited subset (see @peptide/shared/markdown) — no raw HTML.

interface Props {
  text: string;
  // When false, suppress the inline footer (caller renders one shared footer
  // for a list of dose lines instead of one per line).
  showFooter?: boolean;
}

export function DoseAnnotatedText({ text, showFooter = true }: Props) {
  const blocks = parseMarkdown(text);
  const anyDose = hasEduDose(text);

  return (
    <>
      <div className="flex flex-col gap-2">
        {blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
      {anyDose && showFooter && <DoseDisclaimerFooter />}
    </>
  );
}

function Block({ block }: { block: MdBlock }) {
  switch (block.t) {
    case "h": {
      const cls =
        block.level === 1
          ? "text-base font-semibold"
          : block.level === 2
            ? "text-sm font-semibold"
            : "text-sm font-medium";
      return (
        <p className={`${cls} text-[var(--fg)]`}>
          <Inline spans={block.spans} />
        </p>
      );
    }
    case "ul":
      return (
        <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-[var(--fg-subtle)]">
          {block.items.map((it, i) => (
            <li key={i}>
              <Inline spans={it} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="flex list-decimal flex-col gap-1 pl-5 marker:text-[var(--fg-subtle)]">
          {block.items.map((it, i) => (
            <li key={i}>
              <Inline spans={it} />
            </li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-[var(--r-sm)] border border-border bg-[var(--surface-2)] p-2.5 font-[family-name:var(--font-mono)] text-2xs leading-relaxed text-[var(--fg)]">
          {block.v}
        </pre>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {block.header.map((cell, ci) => (
                  <th
                    key={ci}
                    className="border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-left font-semibold text-[var(--fg)]"
                  >
                    <Inline spans={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                // Column count is driven by the header (keeps the grid square);
                // short rows pad with an empty cell, over-long rows truncate.
                <tr key={ri}>
                  {block.header.map((_, ci) => (
                    <td
                      key={ci}
                      className="border border-[var(--border)] px-2 py-1.5 align-top text-[var(--fg)]"
                    >
                      <Inline spans={row[ci] ?? [{ t: "text", v: "" }]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr className="border-[var(--border)]" />;
    default:
      return (
        <p className="leading-[1.6]">
          <Inline spans={block.spans} />
        </p>
      );
  }
}

function Inline({ spans }: { spans: MdInline[] }) {
  return (
    <>
      {spans.map((s, i) => {
        switch (s.t) {
          case "edu":
            return (
              <span
                key={i}
                className="rounded border border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-1 text-[var(--color-accent)]"
                title="Dose values are educational / research summaries only. Discuss with your clinician."
              >
                {s.v}
              </span>
            );
          case "b":
            return (
              <strong key={i} className="font-semibold text-[var(--fg)]">
                {s.v}
              </strong>
            );
          case "i":
            return <em key={i}>{s.v}</em>;
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-[var(--surface-2)] px-1 py-px font-[family-name:var(--font-mono)] text-[0.92em] text-[var(--fg)]"
              >
                {s.v}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] underline underline-offset-2"
              >
                {s.v}
              </a>
            );
          default:
            return <span key={i}>{s.v}</span>;
        }
      })}
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
