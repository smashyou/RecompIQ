import { Button as REButton } from "@react-email/components";
import type { CSSProperties } from "react";
import { palette, radius, fonts } from "../palette";

type Variant = "primary" | "outline";

/**
 * A single, email-safe CTA. React Email's <Button> emits the table/VML padding
 * that makes the click target render across Outlook + Gmail. One primary CTA
 * per email (the design reserves the glow/emphasis for a single action).
 */
export function Button({
  href,
  children,
  variant = "primary",
  fullWidth = false,
}: {
  href: string;
  children: string;
  variant?: Variant;
  fullWidth?: boolean;
}) {
  const variants: Record<Variant, CSSProperties> = {
    primary: {
      backgroundColor: palette.primary,
      color: palette.primaryFg,
      border: `1px solid ${palette.primary}`,
    },
    outline: {
      backgroundColor: palette.surface1,
      color: palette.fg,
      border: `1px solid ${palette.borderStrong}`,
    },
  };
  return (
    <REButton
      href={href}
      style={{
        ...variants[variant],
        fontFamily: fonts.sans,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1,
        textDecoration: "none",
        textAlign: "center",
        borderRadius: radius.md,
        padding: "13px 24px",
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}
    </REButton>
  );
}
