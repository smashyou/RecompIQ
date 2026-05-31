import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow, Callout } from "../../components/content";
import { APP_URL, DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { BodyShotReminderProps } from "../../types";

export const subject = "Time for your progress photos";

/** Nudge when the last body-shot session is past the user's frequency. */
export default function BodyShotReminder({
  firstName,
  daysSinceLast,
  captureUrl = `${APP_URL}/body-shots/capture`,
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: BodyShotReminderProps) {
  return (
    <Layout
      preview="A quick set of progress photos keeps your trajectory honest."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Progress photos</Eyebrow>
      <H1>Time for your next set{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        It&apos;s been{" "}
        <strong style={{ color: "#f4f5f7" }}>{daysSinceLast} days</strong> since
        your last progress photos. The scale moves slowly — photos catch
        composition changes the number misses.
      </P>

      <Callout tone="primary">
        Four angles, same lighting and time of day. It takes about a minute and
        stays private to your account.
      </Callout>

      <CtaRow>
        <Button href={captureUrl}>Capture progress photos</Button>
      </CtaRow>

      <Disclaimer variant="compact" />
    </Layout>
  );
}

BodyShotReminder.PreviewProps = {
  firstName: "Alex",
  daysSinceLast: 9,
} satisfies BodyShotReminderProps;
