import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared responsive layout primitives. Compose every screen from these so
 * responsiveness is inherited, not re-hardcoded:
 *   <Page>          centered, max-width, fluid page padding
 *   <PageHeader>    fluid title + subtitle + optional action (stacks on mobile)
 *   <AutoGrid>      columns that auto-collapse to 1-up on narrow screens,
 *                   children stretch to equal height (no breakpoints needed)
 *   <Stack>/<Cluster> vertical / horizontal flow on the fluid space scale
 *
 * Spacing reads the --space-* clamp tokens (recompiq-tokens.css); type uses the
 * fluid text-* utilities (globals.css @theme).
 */

export function Page({
  children,
  width = "default",
  className,
  style,
}: {
  children: ReactNode;
  /** default = app container (1120px); narrow = forms/reading (560px) */
  width?: "default" | "narrow";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("mx-auto w-full", width === "narrow" ? "max-w-narrow" : "max-w-app", className)}
      style={{
        paddingInline: "var(--space-page)",
        paddingBlock: "var(--space-pagey)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-[var(--space-section)] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em] text-[var(--fg)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm leading-[1.5] text-[var(--fg-muted)]">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

/**
 * Responsive grid that collapses to a single column on narrow screens with no
 * breakpoints, and stretches children to equal height (fixes ragged card rows).
 * `min` is the smallest a column may get before wrapping.
 */
export function AutoGrid({
  children,
  min = "240px",
  className,
  style,
}: {
  children: ReactNode;
  min?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("grid items-stretch", className)}
      style={{
        gap: "var(--space-grid)",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Stack({
  children,
  gap = "var(--space-grid)",
  className,
  style,
}: {
  children: ReactNode;
  gap?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("flex flex-col", className)} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

export function Cluster({
  children,
  gap = "0.5rem",
  className,
  style,
}: {
  children: ReactNode;
  gap?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("flex flex-wrap items-center", className)} style={{ gap, ...style }}>
      {children}
    </div>
  );
}
