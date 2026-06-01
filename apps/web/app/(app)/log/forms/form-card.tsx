import type { ReactNode } from "react";
import { Card } from "@/components/kit";

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
    <Card pad={24}>
      <header className="mb-5 space-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          {subtitle}
        </p>
      </header>
      {children}
    </Card>
  );
}
