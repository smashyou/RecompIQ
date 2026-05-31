import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, getLegalDoc } from "@peptide/shared/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  return { title: doc ? `${doc.title} · RecompIQ` : "Legal · RecompIQ" };
}

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/legal" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
        ← Legal &amp; Safety
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Last updated {doc.updated}</p>
      <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {doc.summary}
      </p>

      <div className="mt-6 space-y-6">
        {doc.sections.map((s, i) => (
          <section key={i} className="space-y-2">
            {s.heading ? <h2 className="text-base font-semibold">{s.heading}</h2> : null}
            {s.body.map((line, j) => (
              <p
                key={j}
                className={`text-sm leading-relaxed text-[var(--color-muted-foreground)] ${line.startsWith("• ") ? "pl-4" : ""}`}
              >
                {line}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-muted-foreground)]">
        This page is general information, not legal advice.
      </p>
    </main>
  );
}
