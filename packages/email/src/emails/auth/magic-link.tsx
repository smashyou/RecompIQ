import { Link, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow, TokenBox } from "../../components/content";
import { palette, fonts } from "../../palette";
import type { MagicLinkProps } from "../../types";

export const subject = "Your RecompIQ sign-in link";

/**
 * Supabase "Magic Link" template. Both {{ .ConfirmationURL }} (one-tap) and
 * {{ .Token }} (manual code) are preserved literally for paste-readiness.
 */
export default function MagicLink({
  confirmationUrl = "{{ .ConfirmationURL }}",
  token = "{{ .Token }}",
}: MagicLinkProps) {
  return (
    <Layout preview="Your one-time sign-in link for RecompIQ.">
      <Eyebrow>Sign in</Eyebrow>
      <H1>Your sign-in link</H1>
      <P muted>
        Tap the button below to sign in to RecompIQ. This link is single-use and
        expires shortly.
      </P>

      <CtaRow>
        <Button href={confirmationUrl}>Sign in to RecompIQ</Button>
      </CtaRow>

      <P muted>Or enter this one-time code:</P>
      <TokenBox value={token} />

      <Text
        style={{
          margin: "16px 0 14px",
          fontFamily: fonts.sans,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: palette.fgSubtle,
        }}
      >
        Trouble with the button? Paste this link instead:
        <br />
        <Link href={confirmationUrl} style={{ color: palette.primaryBright, wordBreak: "break-all" }}>
          {confirmationUrl}
        </Link>
      </Text>

      <P muted>
        If you didn&apos;t request this link, you can ignore this email — no one
        can sign in without it.
      </P>

      <Disclaimer />
    </Layout>
  );
}

MagicLink.PreviewProps = {
  confirmationUrl: "https://recompiq.vercel.app/auth/confirm?token=preview",
  token: "428913",
} satisfies MagicLinkProps;
