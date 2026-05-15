import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5",
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {hint}
          </span>
        )}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--color-muted-foreground)]">{children}</p>;
}

export function ComingSoon({ phase }: { phase: number }) {
  return (
    <p className="text-xs text-[var(--color-muted-foreground)]">
      Wires up in <span className="font-medium text-[var(--color-foreground)]">Phase {phase}</span>.
    </p>
  );
}
