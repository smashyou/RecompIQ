import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      {children}
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
