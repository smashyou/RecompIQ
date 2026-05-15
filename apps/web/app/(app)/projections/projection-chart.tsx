"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
} from "recharts";

interface DatePoint {
  date: string;
  lb: number;
}
interface ActualPoint {
  logged_at: string;
  value_lb: number;
}

interface Props {
  actual: ActualPoint[];
  ma: ActualPoint[];
  conservative: DatePoint[];
  target: DatePoint[];
  aggressive: DatePoint[];
  targetMinLb: number;
  targetMaxLb: number;
  currentLb: number;
}

interface ChartRow {
  date: string;
  actual?: number;
  ma?: number;
  conservative?: number;
  target?: number;
  aggressive?: number;
}

export function ProjectionChart(props: Props) {
  const rows = useMemo(() => buildRows(props), [props]);
  const { minY, maxY } = useMemo(() => {
    const allValues: number[] = [];
    for (const r of rows) {
      for (const k of ["actual", "ma", "conservative", "target", "aggressive"] as const) {
        const v = r[k];
        if (typeof v === "number") allValues.push(v);
      }
    }
    allValues.push(props.targetMinLb, props.targetMaxLb);
    const lo = Math.floor(Math.min(...allValues) - 2);
    const hi = Math.ceil(Math.max(...allValues) + 2);
    return { minY: lo, maxY: hi };
  }, [rows, props.targetMinLb, props.targetMaxLb]);

  return (
    <div className="h-[420px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) =>
              new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            minTickGap={32}
          />
          <YAxis
            domain={[minY, maxY]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            width={42}
            unit=" lb"
          />
          <ReferenceArea
            y1={props.targetMinLb}
            y2={props.targetMaxLb}
            fill="var(--color-accent)"
            fillOpacity={0.12}
            stroke="var(--color-accent)"
            strokeOpacity={0.4}
            strokeDasharray="3 3"
            label={{
              value: "Target band",
              position: "insideTopLeft",
              fontSize: 10,
              fill: "var(--color-muted-foreground)",
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v: string) =>
              new Date(v).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            }
            formatter={(v: number, name: string) => [
              `${v.toFixed(1)} lb`,
              labelFor(name),
            ]}
          />
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            formatter={labelFor}
          />
          <Line
            type="monotone"
            dataKey="conservative"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="aggressive"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ma"
            stroke="var(--color-foreground)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="actual"
            fill="var(--color-foreground)"
            shape="circle"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelFor(key: string): string {
  switch (key) {
    case "actual":
      return "Actual";
    case "ma":
      return "7-day MA";
    case "conservative":
      return "Conservative";
    case "target":
      return "Target";
    case "aggressive":
      return "Aggressive";
    default:
      return key;
  }
}

function buildRows(p: Props): ChartRow[] {
  const map = new Map<string, ChartRow>();

  const ensure = (date: string): ChartRow => {
    if (!map.has(date)) map.set(date, { date });
    return map.get(date)!;
  };

  for (const a of p.actual) {
    const date = a.logged_at.slice(0, 10);
    ensure(date).actual = a.value_lb;
  }
  for (const m of p.ma) {
    const date = m.logged_at.slice(0, 10);
    ensure(date).ma = m.value_lb;
  }
  for (const c of p.conservative) ensure(c.date).conservative = c.lb;
  for (const t of p.target) ensure(t.date).target = t.lb;
  for (const a of p.aggressive) ensure(a.date).aggressive = a.lb;

  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}
