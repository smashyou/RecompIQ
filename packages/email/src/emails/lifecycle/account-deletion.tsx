import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow, Callout } from "../../components/content";
import { LINKS, DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { AccountDeletionProps } from "../../types";

export const subject = "Your RecompIQ account has been deleted";

/** Confirmation that the account + data were deleted (DELETE /api/me cascade). */
export default function AccountDeletion({
  firstName,
  effectiveDate,
  exportUrl,
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: AccountDeletionProps) {
  return (
    <Layout
      preview="Your RecompIQ account and data have been deleted."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Account closed</Eyebrow>
      <H1>Your account has been deleted{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        We&apos;ve permanently deleted your RecompIQ account and the data
        associated with it{effectiveDate ? ` as of ${effectiveDate}` : ""} —
        logs, protocols, photos, and profile. This cannot be undone.
      </P>

      {exportUrl ? (
        <>
          <Callout tone="warn">
            If you requested a final data export, it&apos;s available below for a
            limited time. Save it now — the link expires and can&apos;t be
            reissued once your account is gone.
          </Callout>
          <CtaRow>
            <Button href={exportUrl} variant="outline">
              Download final export
            </Button>
          </CtaRow>
        </>
      ) : null}

      <P muted>
        Thanks for trying RecompIQ. If you change your mind, you&apos;re always
        welcome to start fresh at{" "}
        <a href={LINKS.dashboard} style={{ color: "#46d4de" }}>
          recompiq.com
        </a>
        .
      </P>

      <Disclaimer variant="compact" />
    </Layout>
  );
}

AccountDeletion.PreviewProps = {
  firstName: "Alex",
  effectiveDate: "May 31, 2026",
} satisfies AccountDeletionProps;
