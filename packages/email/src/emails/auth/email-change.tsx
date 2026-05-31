import { Link, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, fonts } from "../../palette";
import type { EmailChangeProps } from "../../types";

export const subject = "Confirm your new RecompIQ email";

/**
 * Supabase "Change Email Address" template. {{ .ConfirmationURL }},
 * {{ .Email }} and {{ .NewEmail }} preserved literally for paste-readiness.
 */
export default function EmailChange({
  confirmationUrl = "{{ .ConfirmationURL }}",
  email = "{{ .Email }}",
  newEmail = "{{ .NewEmail }}",
}: EmailChangeProps) {
  return (
    <Layout preview="Confirm the new email address for your RecompIQ account.">
      <Eyebrow>Email change</Eyebrow>
      <H1>Confirm your new email</H1>
      <P muted>
        We received a request to change the email on your RecompIQ account from{" "}
        <span style={{ color: palette.fg, fontFamily: fonts.mono, fontSize: 13 }}>{email}</span>{" "}
        to{" "}
        <span style={{ color: palette.fg, fontFamily: fonts.mono, fontSize: 13 }}>{newEmail}</span>.
        Confirm below to complete the change.
      </P>

      <CtaRow>
        <Button href={confirmationUrl}>Confirm new email</Button>
      </CtaRow>

      <Text
        style={{
          margin: "0 0 14px",
          fontFamily: fonts.sans,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: palette.fgSubtle,
        }}
      >
        Or paste this link into your browser:
        <br />
        <Link href={confirmationUrl} style={{ color: palette.primaryBright, wordBreak: "break-all" }}>
          {confirmationUrl}
        </Link>
      </Text>

      <P muted>
        If you didn&apos;t request this change, ignore this email and your
        address will stay the same.
      </P>

      <Disclaimer />
    </Layout>
  );
}

EmailChange.PreviewProps = {
  confirmationUrl: "https://recompiq.vercel.app/auth/confirm?token=preview",
  email: "old@example.com",
  newEmail: "new@example.com",
} satisfies EmailChangeProps;
