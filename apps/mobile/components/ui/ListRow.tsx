import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 active:opacity-70"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface1,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface2,
          }}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-base font-medium" style={{ color: colors.foreground }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm" style={{ color: colors.fgSubtle }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />}
    </Pressable>
  );
}
