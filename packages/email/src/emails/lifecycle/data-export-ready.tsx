import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow, Callout } from "../../components/content";
import { DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { DataExportReadyProps } from "../../types";

export const subject = "Your RecompIQ data export is ready";

/** Sent when a requested JSON/CSV export finishes and a signed URL is ready. */
export default function DataExportReady({
  firstName,
  downloadUrl,
  expiresAt,
  formats = "JSON + CSV",
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: DataExportReadyProps) {
  return (
    <Layout
      preview={`Your data export (${formats}) is ready to download.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Data export</Eyebrow>
      <H1>Your export is ready{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        We&apos;ve packaged your RecompIQ data ({formats}) — profile, logs,
        protocols, and biomarker history. Download it with the button below.
      </P>

      <Callout tone="primary">
        For your security, this link expires on{" "}
        <strong style={{ color: "#f4f5f7" }}>{expiresAt}</strong>. After that
        you can request a fresh export anytime from Settings.
      </Callout>

      <CtaRow>
        <Button href={downloadUrl}>Download export</Button>
      </CtaRow>

      <P muted>
        If you didn&apos;t request this export, please review your account
        security and contact support.
      </P>

      <Disclaimer variant="compact" />
    </Layout>
  );
}

DataExportReady.PreviewProps = {
  firstName: "Alex",
  downloadUrl: "https://recompiq.vercel.app/exports/preview.zip",
  expiresAt: "June 7, 2026",
  formats: "JSON + CSV",
} satisfies DataExportReadyProps;
