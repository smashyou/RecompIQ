"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

interface Point {
  logged_at: string;
  value_lb: number;
}

export function WeightSparkline({ data }: { data: Point[] }) {
  if (data.length === 0) return null;
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            labelFormatter={(v: string) =>
              new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            formatter={(v: number) => [`${v.toFixed(1)} lb`, "Weight"]}
          />
          <Area
            type="monotone"
            dataKey="value_lb"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#weightFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
