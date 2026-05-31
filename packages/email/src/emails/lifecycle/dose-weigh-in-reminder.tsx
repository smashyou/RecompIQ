import { Section, Text } from "@react-email/components";
import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow } from "../../components/content";
import { palette, radius, fonts } from "../../palette";
import { APP_URL, DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { DoseWeighInReminderProps } from "../../types";

export const subject = "Today's tracking reminder";

/**
 * Daily nudge for protocols the user logged + an optional weigh-in. Lists the
 * user's OWN scheduled items — it does not tell them what or how much to take.
 */
export default function DoseWeighInReminder({
  firstName,
  items,
  includeWeighIn = true,
  logUrl = `${APP_URL}/log`,
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: DoseWeighInReminderProps) {
  return (
    <Layout
      preview="A reminder to log today's protocol and weigh-in."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Daily reminder</Eyebrow>
      <H1>Today&apos;s tracking{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        Here&apos;s what you scheduled for today. Mark each item once
        you&apos;ve recorded it.
      </P>

      <Section
        style={{
          backgroundColor: palette.surface1,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.md,
          padding: "6px 16px",
          margin: "0 0 16px",
        }}
      >
        {items.map((item, i) => (
          <Text
            key={`${item.label}-${i}`}
            style={{
              margin: 0,
              padding: "10px 0",
              borderBottom:
                i < items.length - 1 || includeWeighIn
                  ? `1px solid ${palette.border}`
                  : "none",
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 1.5,
              color: palette.fg,
            }}
          >
            <span style={{ color: palette.primary, marginRight: 8 }}>○</span>
            {item.label}
            {item.detail ? (
              <span style={{ color: palette.fgSubtle }}> — {item.detail}</span>
            ) : null}
          </Text>
        ))}
        {includeWeighIn ? (
          <Text
            style={{
              margin: 0,
              padding: "10px 0",
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 1.5,
              color: palette.fg,
            }}
          >
            <span style={{ color: palette.primary, marginRight: 8 }}>○</span>
            Morning weigh-in
            <span style={{ color: palette.fgSubtle }}> — same scale, same time</span>
          </Text>
        ) : null}
      </Section>

      <CtaRow>
        <Button href={logUrl}>Log today&apos;s entries</Button>
      </CtaRow>

      <Disclaimer />
    </Layout>
  );
}

DoseWeighInReminder.PreviewProps = {
  firstName: "Alex",
  items: [
    { label: "Retatrutide + AOD-9604", detail: "your scheduled protocol" },
    { label: "KLOW blend", detail: "evening" },
  ],
  includeWeighIn: true,
} satisfies DoseWeighInReminderProps;
