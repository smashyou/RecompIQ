import { Link, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, fonts } from "../../palette";
import type { ConfirmSignupProps } from "../../types";

export const subject = "Confirm your RecompIQ email";

/**
 * Supabase "Confirm signup" template. {{ .ConfirmationURL }} is preserved
 * literally via the default prop value so this render is paste-ready.
 */
export default function ConfirmSignup({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: ConfirmSignupProps) {
  return (
    <Layout preview="Confirm your email to activate your RecompIQ account.">
      <Eyebrow>Confirm your account</Eyebrow>
      <H1>Verify your email address</H1>
      <P muted>
        Welcome to RecompIQ — your educational body-recomposition and
        peptide-research workspace. Confirm this address to activate your
        account and start tracking.
      </P>

      <CtaRow>
        <Button href={confirmationUrl}>Confirm email address</Button>
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
        If you didn&apos;t create a RecompIQ account, you can safely ignore this
        email.
      </P>

      <Disclaimer />
    </Layout>
  );
}

ConfirmSignup.PreviewProps = {
  confirmationUrl: "https://recompiq.vercel.app/auth/confirm?token=preview",
} satisfies ConfirmSignupProps;
