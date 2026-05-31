import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/theme";

export interface TileOption<T extends string> {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Icon-tile grid selector — for fixed option sets that would otherwise wrap or
// scroll awkwardly (Quick Log types, category filters). Uses fixed-width cells
// with padding for the gap so tiles are evenly spaced and the last row fills
// from the left (no stretched gaps between buttons).
export function TileSelect<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: ReadonlyArray<TileOption<T>>;
  value: T;
  onChange: (v: T) => void;
  columns?: 3 | 4;
}) {
  const cellWidth = `${100 / columns}%` as `${number}%`;
  return (
    <View className="flex-row flex-wrap">
      {options.map((t) => {
        const active = t.value === value;
        return (
          <View key={t.value} style={{ width: cellWidth }} className="p-1">
            <Pressable
              onPress={() => onChange(t.value)}
              className={cn(
                "items-center gap-1.5 rounded-xl border py-3.5 active:opacity-80",
                active ? "border-primary bg-muted" : "border-border bg-card",
              )}
            >
              <Ionicons name={t.icon} size={22} color={active ? colors.primary : colors.mutedForeground} />
              <Text
                numberOfLines={1}
                className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                {t.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
