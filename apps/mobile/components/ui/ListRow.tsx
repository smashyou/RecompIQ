import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 active:opacity-70"
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.primary} /> : null}
      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{title}</Text>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}
    </Pressable>
  );
}
