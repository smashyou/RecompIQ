import { Section, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, radius, fonts } from "../../palette";
import { DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { SafetyAlertEmailProps } from "../../types";

export const subject = "Safety alert(s) to review";

/**
 * Surfaces safety alerts the engine flagged from the user's OWN logged data.
 * Title / message / citation are rendered VERBATIM from the vetted, non-
 * prescribing catalog — this email never adds dose or instruction wording.
 * Framing is observational: things to discuss with a clinician, not advice.
 */
export default function SafetyAlert({
  firstName,
  alerts,
  alertsUrl,
}: SafetyAlertEmailProps) {
  return (
    <Layout
      preview="RecompIQ flagged something in your logged data to review."
      unsubscribeUrl={DEFAULT_UNSUBSCRIBE_URL}
    >
      <Eyebrow>Safety alert</Eyebrow>
      <H1>Safety alert(s) to review{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        RecompIQ flagged the following in your logged data — these are
        observations to discuss with your clinician, not medical advice.
      </P>

      <Section
        style={{
          backgroundColor: palette.surface1,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.md,
          padding: "4px 16px",
          margin: "0 0 16px",
        }}
      >
        {alerts.map((alert, i) => {
          const sev =
            alert.severity === "critical"
              ? { label: "Critical", bg: palette.dangerWash, line: palette.dangerLine, fg: palette.dangerBright }
              : { label: "Warning", bg: palette.warnWash, line: palette.warnLine, fg: palette.warn };
          return (
            <Section
              key={`${alert.title}-${i}`}
              style={{
                padding: "14px 0",
                borderBottom:
                  i < alerts.length - 1 ? `1px solid ${palette.border}` : "none",
              }}
            >
              <Text
                style={{
                  margin: "0 0 6px",
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: palette.fg,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    marginRight: 8,
                    padding: "1px 8px",
                    borderRadius: radius.pill,
                    backgroundColor: sev.bg,
                    border: `1px solid ${sev.line}`,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: sev.fg,
                  }}
                >
                  {sev.label}
                </span>
                {alert.title}
              </Text>
              <Text
                style={{
                  margin: "0 0 6px",
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: palette.fgMuted,
                }}
              >
                {alert.message}
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontFamily: fonts.sans,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: palette.fgSubtle,
                }}
              >
                {alert.evidenceLevel} · {alert.citation}
              </Text>
            </Section>
          );
        })}
      </Section>

      <CtaRow>
        <Button href={alertsUrl}>View in RecompIQ</Button>
      </CtaRow>

      <Disclaimer />
    </Layout>
  );
}

SafetyAlert.PreviewProps = {
  firstName: "Alex",
  alerts: [
    {
      title: "Elevated blood pressure logged",
      message:
        "Your most recent reading (166/99) is in the stage 2 range. Consider sharing this trend with your clinician.",
      severity: "critical",
      evidenceLevel: "FDA_APPROVED",
      citation: "ACC/AHA 2017 BP guideline",
    },
    {
      title: "Fasting glucose above target range",
      message:
        "Several recent fasting glucose entries are above your set target. This is an observation to review with your care team.",
      severity: "warn",
      evidenceLevel: "HUMAN_OBS",
      citation: "ADA Standards of Care 2025",
    },
  ],
  alertsUrl: "https://recompiq.com/alerts",
} satisfies SafetyAlertEmailProps;
