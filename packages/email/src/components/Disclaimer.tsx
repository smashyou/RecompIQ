import { Section, Text } from "@react-email/components";
import { palette, radius, fonts } from "../palette";
import { DISCLAIMER_LEAD, DISCLAIMER_BODY } from "../config";

/**
 * The verbatim compliance block (design §8). Mirrors the in-app
 * <SafetyDisclaimer default> — primary-wash panel, bold lead, muted body.
 * Copy is FIXED — never paraphrased per email. Shown on every email that
 * touches doses / protocols / compounds, and as a baseline trust signal
 * elsewhere.
 */
export function Disclaimer({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <Section
        style={{
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.surface1,
          borderRadius: radius.sm,
          padding: "9px 12px",
        }}
      >
        <Text
          style={{
            margin: 0,
            fontFamily: fonts.sans,
            fontSize: 11.5,
            lineHeight: 1.45,
            color: palette.fgSubtle,
          }}
        >
          Educational tracking only · Discuss any protocol with a licensed clinician.
        </Text>
      </Section>
    );
  }
  return (
    <Section
      style={{
        border: `1px solid ${palette.primaryLine}`,
        backgroundColor: palette.primaryWash,
        borderRadius: radius.md,
        padding: "14px 16px",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: fonts.sans,
          fontWeight: 600,
          fontSize: 13.5,
          lineHeight: 1.4,
          color: palette.fg,
        }}
      >
        {DISCLAIMER_LEAD}
      </Text>
      <Text
        style={{
          margin: "4px 0 0",
          fontFamily: fonts.sans,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: palette.fgMuted,
        }}
      >
        {DISCLAIMER_BODY}
      </Text>
    </Section>
  );
}
