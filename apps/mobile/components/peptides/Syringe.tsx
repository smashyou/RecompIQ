import { View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import type { SyringeModel } from "@peptide/peptides/reconstitution";
import { colors } from "@/lib/theme";

// Renders the SVG syringe from the pure-TS syringeModel() tick data. Horizontal
// barrel reads well on a phone; the plunger line marks the draw level.
const VB_W = 320;
const VB_H = 96;
const X0 = 16;
const BAR_W = 272;
const BAR_Y = 30;
const BAR_H = 40;

export function Syringe({ model }: { model: SyringeModel }) {
  const fillColor = model.overfilled ? colors.destructive : colors.primary;
  const fillW = BAR_W * model.fillFraction;
  const cap = model.capacityUnits || 1;

  return (
    <View className="items-center">
      <Svg width="100%" height={120} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* barrel */}
        <Rect
          x={X0}
          y={BAR_Y}
          width={BAR_W}
          height={BAR_H}
          rx={8}
          fill={colors.card}
          stroke={colors.border}
          strokeWidth={1.5}
        />
        {/* fill */}
        <Rect x={X0} y={BAR_Y} width={fillW} height={BAR_H} rx={8} fill={fillColor} opacity={0.35} />

        {/* ticks */}
        {model.ticks.map((t, i) => {
          const x = X0 + (t.units / cap) * BAR_W;
          const top = t.major ? 16 : 22;
          return (
            <Line
              key={i}
              x1={x}
              y1={top}
              x2={x}
              y2={BAR_Y}
              stroke={colors.mutedForeground}
              strokeWidth={t.major ? 1.2 : 0.6}
            />
          );
        })}
        {model.ticks
          .filter((t) => t.major)
          .map((t, i) => {
            const x = X0 + (t.units / cap) * BAR_W;
            return (
              <SvgText
                key={`l${i}`}
                x={x}
                y={12}
                fontSize={8}
                fill={colors.mutedForeground}
                textAnchor="middle"
              >
                {t.units}
              </SvgText>
            );
          })}

        {/* plunger / draw level */}
        <Line
          x1={X0 + fillW}
          y1={BAR_Y - 4}
          x2={X0 + fillW}
          y2={BAR_Y + BAR_H + 4}
          stroke={fillColor}
          strokeWidth={2.5}
        />
      </Svg>
    </View>
  );
}
