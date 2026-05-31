import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/cn";

// iOS-style segmented track: one rounded container, active segment filled.
// Use for 2–4 option toggles and sub-tabs. `fill` makes segments span the full
// width (for sub-tab navigators); default is content-width (compact toggles).
// For many-option sets that would overflow, use <TileSelect> instead.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill = false,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  fill?: boolean;
}) {
  return (
    <View className={cn("flex-row gap-1 rounded-lg bg-muted p-1", !fill && "self-start")}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            onPress={() => onChange(opt.value)}
            className={cn("rounded-md px-3 py-2", fill && "flex-1", active && "bg-primary")}
          >
            <Text
              numberOfLines={1}
              className={cn(
                "text-center text-sm font-medium",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
