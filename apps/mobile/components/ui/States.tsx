import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "@/lib/theme";

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-background py-16">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View className="rounded-lg border border-destructive bg-card p-4">
      <Text className="text-sm text-destructive">{message}</Text>
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
  return (
    <View className="items-center gap-2 rounded-xl border border-border bg-card p-8">
      <Text className="text-base font-medium text-foreground">{title}</Text>
      {hint ? <Text className="text-center text-sm text-muted-foreground">{hint}</Text> : null}
      {children}
    </View>
  );
}
