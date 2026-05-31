import type { CSSProperties, ReactNode } from "react";

/**
 * Shared instrument-grade primitives, matching the design handoff's
 * Primitives.jsx (Card / Stat / Overline / Chip / SectionHeader / MetricBox).
 * Use these to compose authenticated routes so every screen reads as the same
 * border-led, mono-data card system as the dashboard + compound detail.
 * Token-driven (works in light + dark).
 */

export function Overline({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--fg-subtle)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Border-led card — the primary container. */
export function Card({
  title,
  hint,
  children,
  pad = 18,
  style,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: pad,
        ...style,
      }}
    >
      {(title || hint) && (
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {title && (
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--fg)",
              }}
            >
              {title}
            </h2>
          )}
          {hint && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 9.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--fg-subtle)",
              }}
            >
              {hint}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Big mono metric: tabular value + subordinate unit + optional caption. */
export function Stat({
  value,
  unit,
  label,
  tone,
  size = 28,
}: {
  value: ReactNode;
  unit?: string;
  label?: ReactNode;
  tone?: "pos" | "warn" | "danger";
  size?: number;
}) {
  const color =
    tone === "pos"
      ? "var(--positive)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "danger"
          ? "var(--danger)"
          : "var(--fg)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          fontSize: size,
          letterSpacing: "-0.02em",
          color,
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: size * 0.46, color: "var(--fg-subtle)", marginLeft: 3 }}>
            {unit}
          </span>
        )}
      </span>
      {label && <Overline style={{ fontSize: 9.5, letterSpacing: "0.08em" }}>{label}</Overline>}
    </div>
  );
}

/** Page section header — eyebrow number + display title + optional note. */
export function SectionHeader({
  title,
  note,
  num,
}: {
  title: ReactNode;
  note?: ReactNode;
  num?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        paddingBottom: 14,
        marginBottom: 20,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {num && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--primary)" }}>
          {num}
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: "var(--fg)",
        }}
      >
        {title}
      </span>
      {note && (
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--fg-subtle)" }}>{note}</span>
      )}
    </div>
  );
}

/** Filter / toggle chip. */
export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 12px",
        borderRadius: "var(--r-pill)",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        fontSize: 12.5,
        cursor: onClick ? "pointer" : "default",
        border: active ? "1px solid var(--primary-line)" : "1px solid var(--border)",
        background: active ? "var(--primary-wash)" : "var(--surface-1)",
        color: active ? "var(--primary-bright)" : "var(--fg-muted)",
      }}
    >
      {children}
    </button>
  );
}

/** Small bordered metric box (used in stat rows / detail headers). */
export function MetricBox({
  label,
  value,
  unit,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          fontSize: 18,
          letterSpacing: "-0.02em",
          color: "var(--fg)",
        }}
      >
        {value}
        {unit && <span style={{ fontSize: 11, color: "var(--fg-subtle)", marginLeft: 3 }}>{unit}</span>}
      </div>
      <Overline style={{ fontSize: 9.5, letterSpacing: "0.08em", marginTop: 4, display: "block" }}>
        {label}
      </Overline>
    </div>
  );
}
