import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

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
  const { colors } = useTheme();
  return (
    <View
      className={cn("flex-row gap-1 p-1", !fill && "self-start")}
      style={{ borderRadius: radius.md, backgroundColor: colors.surface2 }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            onPress={() => onChange(opt.value)}
            className={cn("px-3 py-2", fill && "flex-1")}
            style={{ borderRadius: radius.sm, backgroundColor: active ? colors.primary : "transparent" }}
          >
            <Text
              numberOfLines={1}
              className="text-center text-sm font-medium"
              style={{ color: active ? colors.primaryForeground : colors.mutedForeground }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
