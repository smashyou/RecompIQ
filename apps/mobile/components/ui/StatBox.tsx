import { Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

export function StatBox({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive";
  className?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      className={cn("min-w-[44%] flex-1 p-3", className)}
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
      }}
    >
      <Text style={{ fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: colors.fgSubtle }}>
        {label}
      </Text>
      <Text
        className="mt-1 text-lg font-semibold"
        style={{ color: tone === "positive" ? colors.positive : colors.foreground }}
      >
        {value}
      </Text>
      {sub ? <Text className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>{sub}</Text> : null}
    </View>
  );
}
