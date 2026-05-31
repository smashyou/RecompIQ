import { Text, View } from "react-native";
import { cn } from "@/lib/cn";

export function StatBox({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <View className={cn("min-w-[44%] flex-1 rounded-lg border border-border bg-muted p-3", className)}>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-lg font-semibold text-foreground">{value}</Text>
      {sub ? <Text className="mt-0.5 text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}
