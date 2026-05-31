import Link from "next/link";
import { LEGAL_DOCS } from "@peptide/shared/legal";

export const metadata = { title: "Legal & Safety · RecompIQ" };

export default function LegalHub() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Legal &amp; Safety</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        RecompIQ is an educational and research-tracking tool — not medical advice, and not a source
        for any compound.
      </p>

      <ul className="mt-6 space-y-3">
        {LEGAL_DOCS.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/legal/${d.slug}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-muted)]"
            >
              <p className="font-medium">{d.title}</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{d.summary}</p>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Updated {d.updated}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
