import { Hr, Link, Section, Text } from "@react-email/components";
import { palette, fonts } from "../palette";
import {
  DISCLAIMER_LEAD,
  DISCLAIMER_BODY,
  MAILING_ADDRESS,
  LINKS,
  PRODUCT_NAME,
} from "../config";

const linkStyle = {
  color: palette.fgSubtle,
  textDecoration: "underline",
  fontFamily: fonts.sans,
  fontSize: 11.5,
} as const;

/**
 * Compliant footer. The verbatim disclaimer always renders. Group B
 * (marketing/lifecycle) emails pass an `unsubscribeUrl`; Group A (transactional
 * auth) omits it. The physical mailing address is required for commercial mail.
 */
export function Footer({ unsubscribeUrl }: { unsubscribeUrl?: string }) {
  return (
    <Section style={{ padding: "0 24px 28px" }}>
      <Hr style={{ borderColor: palette.border, margin: "0 0 16px" }} />

      <Text
        style={{
          margin: "0 0 4px",
          fontFamily: fonts.sans,
          fontWeight: 600,
          fontSize: 11.5,
          lineHeight: 1.45,
          color: palette.fgSubtle,
        }}
      >
        {DISCLAIMER_LEAD}
      </Text>
      <Text
        style={{
          margin: "0 0 14px",
          fontFamily: fonts.sans,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: palette.fgFaint,
        }}
      >
        {DISCLAIMER_BODY} 18+ only.
      </Text>

      <Text style={{ margin: "0 0 8px", fontSize: 11.5, lineHeight: 1.6 }}>
        <Link href={LINKS.disclaimer} style={linkStyle}>
          Medical Disclaimer
        </Link>
        <span style={{ color: palette.fgFaint }}> · </span>
        <Link href={LINKS.research} style={linkStyle}>
          Research-Use
        </Link>
        <span style={{ color: palette.fgFaint }}> · </span>
        <Link href={LINKS.terms} style={linkStyle}>
          Terms
        </Link>
        <span style={{ color: palette.fgFaint }}> · </span>
        <Link href={LINKS.privacy} style={linkStyle}>
          Privacy
        </Link>
        {unsubscribeUrl ? (
          <>
            <span style={{ color: palette.fgFaint }}> · </span>
            <Link href={unsubscribeUrl} style={linkStyle}>
              Unsubscribe
            </Link>
          </>
        ) : null}
      </Text>

      <Text
        style={{
          margin: 0,
          fontFamily: fonts.sans,
          fontSize: 11,
          lineHeight: 1.5,
          color: palette.fgFaint,
        }}
      >
        © {PRODUCT_NAME}. {MAILING_ADDRESS}
        {unsubscribeUrl
          ? " · You're receiving this because you have a RecompIQ account."
          : ""}
      </Text>
    </Section>
  );
}
