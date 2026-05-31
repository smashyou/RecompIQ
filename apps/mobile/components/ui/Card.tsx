import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ViewProps) {
  return (
    <View className={cn("rounded-xl border border-border bg-card p-4", className)} {...rest} />
  );
}
