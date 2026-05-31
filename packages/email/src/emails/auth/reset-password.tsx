import { Link, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, fonts } from "../../palette";
import type { ResetPasswordProps } from "../../types";

export const subject = "Reset your RecompIQ password";

/**
 * Supabase "Reset Password" template. {{ .ConfirmationURL }} preserved
 * literally for paste-readiness.
 */
export default function ResetPassword({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: ResetPasswordProps) {
  return (
    <Layout preview="Reset your RecompIQ password.">
      <Eyebrow>Password reset</Eyebrow>
      <H1>Reset your password</H1>
      <P muted>
        We received a request to reset the password for your RecompIQ account.
        Choose a new password using the button below. This link expires shortly.
      </P>

      <CtaRow>
        <Button href={confirmationUrl}>Reset password</Button>
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
        If you didn&apos;t request a password reset, you can ignore this email —
        your password won&apos;t change.
      </P>

      <Disclaimer />
    </Layout>
  );
}

ResetPassword.PreviewProps = {
  confirmationUrl: "https://recompiq.vercel.app/auth/recover?token=preview",
} satisfies ResetPasswordProps;
