import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

export type PillTone = "default" | "primary" | "accent" | "warn" | "destructive";

export function Pill({ label, tone = "default" }: { label: string; tone?: PillTone }) {
  const { colors } = useTheme();
  const TONE: Record<PillTone, string> = {
    default: colors.mutedForeground,
    primary: colors.primary,
    accent: colors.accent,
    warn: colors.warn,
    destructive: colors.destructive,
  };
  const c = TONE[tone];
  return (
    <View
      className="shrink-0 self-start"
      style={{
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c,
      }}
    >
      <Text className="text-[10px] font-semibold uppercase" style={{ color: c, letterSpacing: 0.7 }}>
        {label}
      </Text>
    </View>
  );
}
