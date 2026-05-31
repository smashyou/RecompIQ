import { Layout } from "../../components/Layout";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { H1, P, CtaRow, Eyebrow, StatGrid } from "../../components/content";
import type { MetricItem } from "../../components/content";
import { LINKS, DEFAULT_UNSUBSCRIBE_URL } from "../../config";
import type { WeeklySummaryProps } from "../../types";

export const subject = "Your RecompIQ week in review";

/** Weekly progress digest. Numbers render in mono/tabular via StatGrid. */
export default function WeeklySummary({
  firstName,
  weekRange,
  weightChange,
  weightChangeUnit = "lb",
  weightTrend = "down",
  currentWeight,
  proteinAvg,
  proteinTarget,
  doseAdherencePct,
  daysLogged,
  dashboardUrl = LINKS.dashboard,
  unsubscribeUrl = DEFAULT_UNSUBSCRIBE_URL,
}: WeeklySummaryProps) {
  const metrics: MetricItem[] = [
    {
      label: "Weight change",
      value: weightChange,
      unit: weightChangeUnit,
      // For body recomp, weight loss is the on-track direction → green.
      tone: weightTrend === "down" ? "positive" : "default",
    },
    { label: "Current", value: currentWeight, unit: weightChangeUnit },
    { label: "Avg protein", value: proteinAvg, unit: "g" },
    { label: "Dose adherence", value: String(doseAdherencePct), unit: "%" },
  ];

  return (
    <Layout
      preview={`${weekRange}: weight ${weightChange} ${weightChangeUnit}, ${doseAdherencePct}% adherence.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Week of {weekRange}</Eyebrow>
      <H1>Your week in review{firstName ? `, ${firstName}` : ""}</H1>
      <P muted>
        A snapshot of what you logged this week. These are your own entries —
        descriptive, not prescriptive.
      </P>

      <StatGrid items={metrics} />

      <P muted>
        You logged on <strong style={{ color: "#f4f5f7" }}>{daysLogged} of 7</strong> days
        {proteinTarget
          ? `, averaging ${proteinAvg} g protein against your ${proteinTarget} g target.`
          : "."}{" "}
        Open the dashboard for your full trajectory and projection lines.
      </P>

      <CtaRow>
        <Button href={dashboardUrl}>View full dashboard</Button>
      </CtaRow>

      <Disclaimer />
    </Layout>
  );
}

WeeklySummary.PreviewProps = {
  firstName: "Alex",
  weekRange: "May 19 – May 25",
  weightChange: "−2.4",
  weightChangeUnit: "lb",
  weightTrend: "down",
  currentWeight: "258.6",
  proteinAvg: "171",
  proteinTarget: "160–190",
  doseAdherencePct: 92,
  daysLogged: 6,
} satisfies WeeklySummaryProps;
