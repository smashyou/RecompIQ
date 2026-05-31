import type { ReactNode } from "react";
import { Heading, Section, Text } from "@react-email/components";
import { palette, radius, fonts } from "../palette";

/** Small wide-tracked overline — the brand's signature label. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 6px",
        fontFamily: fonts.sans,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: palette.fgSubtle,
      }}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: "0 0 12px",
        fontFamily: fonts.display,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: "-0.015em",
        lineHeight: 1.2,
        color: palette.fg,
      }}
    >
      {children}
    </Heading>
  );
}

export function P({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text
      style={{
        margin: "0 0 14px",
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 1.6,
        color: muted ? palette.fgMuted : palette.fg,
      }}
    >
      {children}
    </Text>
  );
}

/** A monospace box for a one-time code / token. */
export function TokenBox({ value }: { value: string }) {
  return (
    <Section
      style={{
        backgroundColor: palette.surface2,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.md,
        padding: "16px 20px",
        textAlign: "center",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: fonts.mono,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.18em",
          color: palette.fg,
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

/** Tinted callout. tone maps to the design's primary/positive/warn washes. */
export function Callout({
  tone = "primary",
  children,
}: {
  tone?: "primary" | "positive" | "warn";
  children: ReactNode;
}) {
  const map = {
    primary: { bg: palette.primaryWash, line: palette.primaryLine },
    positive: { bg: palette.positiveWash, line: palette.positiveLine },
    warn: { bg: palette.warnWash, line: palette.warnLine },
  }[tone];
  return (
    <Section
      style={{
        backgroundColor: map.bg,
        border: `1px solid ${map.line}`,
        borderRadius: radius.md,
        padding: "12px 16px",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: fonts.sans,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: palette.fgMuted,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

/** A single metric in a stat row: big mono number + caption. */
export interface MetricItem {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "positive";
}

/** Bordered grid of metrics — used by the weekly summary. */
export function StatGrid({ items }: { items: MetricItem[] }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        borderCollapse: "separate",
        borderSpacing: 8,
        margin: "0 -8px 8px",
        width: "calc(100% + 16px)",
      }}
    >
      <tbody>
        <tr>
          {items.map((m) => (
            <td
              key={m.label}
              style={{
                width: `${Math.floor(100 / items.length)}%`,
                verticalAlign: "top",
                backgroundColor: palette.surface1,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.md,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                  color: m.tone === "positive" ? palette.positive : palette.fg,
                }}
              >
                {m.value}
                {m.unit ? (
                  <span style={{ fontSize: 12, color: palette.fgSubtle, marginLeft: 3 }}>
                    {m.unit}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: fonts.sans,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: palette.fgSubtle,
                }}
              >
                {m.label}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Centered CTA wrapper (consistent vertical rhythm around the one button). */
export function CtaRow({ children }: { children: ReactNode }) {
  return (
    <Section style={{ padding: "6px 0 18px" }}>{children}</Section>
  );
}
