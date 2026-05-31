import { Section, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, fonts } from "../../palette";
import { LINKS, DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { WelcomeProps } from "../../types";

export const subject = "Welcome to RecompIQ";

const bullets = [
  "Track weight, vitals, sleep, steps, and protein in one place.",
  "Log peptide-research protocols you or your clinician define — never prescribed by us.",
  "Project your trajectory with conservative, target, and aggressive lines.",
  "Ask the coach for evidence-graded, source-cited education.",
];

/** Sent once onboarding completes. */
export default function Welcome({
  firstName,
  dashboardUrl = LINKS.dashboard,
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: WelcomeProps) {
  return (
    <Layout
      preview="Your RecompIQ workspace is ready — here's how to get the most from it."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>You&apos;re in</Eyebrow>
      <H1>Welcome to RecompIQ{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        Your workspace is set up. RecompIQ is an instrument for educating and
        tracking — it surfaces, projects, and flags, but it never prescribes.
        Here&apos;s what you can do now:
      </P>

      <Section style={{ margin: "0 0 18px" }}>
        {bullets.map((b) => (
          <Text
            key={b}
            style={{
              margin: "0 0 8px",
              paddingLeft: 18,
              position: "relative",
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 1.55,
              color: palette.fgMuted,
            }}
          >
            <span style={{ color: palette.primary, position: "absolute", left: 0 }}>→</span>
            {b}
          </Text>
        ))}
      </Section>

      <CtaRow>
        <Button href={dashboardUrl}>Open your dashboard</Button>
      </CtaRow>

      <Disclaimer />
    </Layout>
  );
}

Welcome.PreviewProps = {
  firstName: "Alex",
} satisfies WelcomeProps;
