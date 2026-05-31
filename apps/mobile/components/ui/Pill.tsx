import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

export type PillTone = "default" | "primary" | "accent" | "destructive";

const TONE: Record<PillTone, string> = {
  default: colors.mutedForeground,
  primary: colors.primary,
  accent: colors.accent,
  destructive: colors.destructive,
};

export function Pill({ label, tone = "default" }: { label: string; tone?: PillTone }) {
  const c = TONE[tone];
  return (
    <View className="shrink-0 self-start rounded-full border px-2 py-0.5" style={{ borderColor: c }}>
      <Text className="text-[10px] font-medium uppercase" style={{ color: c, letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}
