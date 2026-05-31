import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import { palette, radius, fonts } from "../palette";
import { Wordmark } from "./Wordmark";
import { Footer } from "./Footer";

/**
 * Outer chrome shared by every RecompIQ email.
 *
 * - Dark-first, baked in. The `color-scheme` meta tags keep dark-mode clients
 *   (Apple Mail, Outlook.com) from re-inverting the already-dark design.
 * - <=600px centered container, table-driven by React Email's primitives.
 * - `preview` is the inbox preheader. Pass `unsubscribeUrl` only for Group B.
 */
export function Layout({
  preview,
  children,
  unsubscribeUrl,
}: {
  preview: string;
  children: ReactNode;
  unsubscribeUrl?: string;
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="dark light" />
        <meta name="supported-color-schemes" content="dark light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: palette.bgDeep,
          fontFamily: fonts.sans,
          WebkitTextSizeAdjust: "100%",
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: 600,
            margin: "0 auto",
            padding: "24px 0 0",
          }}
        >
          {/* Card frame */}
          <Section
            style={{
              backgroundColor: palette.bg,
              border: `1px solid ${palette.border}`,
              borderRadius: radius.lg,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <Section
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              <Wordmark size={22} />
            </Section>

            {/* Body content */}
            <Section style={{ padding: "24px 24px 8px" }}>{children}</Section>

            <Footer unsubscribeUrl={unsubscribeUrl} />
          </Section>

          {/* Spacer beneath the card */}
          <Section style={{ height: 24 }} />
        </Container>
      </Body>
    </Html>
  );
}
