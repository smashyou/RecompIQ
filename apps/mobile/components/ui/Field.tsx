import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const { colors } = useTheme();
  return (
    <View className={cn("gap-1.5", className)}>
      <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: colors.mutedForeground }}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={{ fontSize: 11, color: colors.dangerBright }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 11, color: colors.fgSubtle }}>{hint}</Text>
      ) : null}
    </View>
  );
}
