import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

export function Loading() {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center justify-center py-16" style={{ backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      className="p-4"
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.dangerLine,
        backgroundColor: colors.dangerWash,
      }}
    >
      <Text className="text-sm" style={{ color: colors.danger }}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="items-center gap-2 p-8"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface1,
      }}
    >
      <Text className="text-base font-medium" style={{ color: colors.foreground }}>
        {title}
      </Text>
      {hint ? (
        <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
