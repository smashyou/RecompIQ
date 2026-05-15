import type { ReactNode } from "react";

export function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <header className="mb-5 space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
