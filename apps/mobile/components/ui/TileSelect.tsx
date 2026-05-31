import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

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
  const { colors } = useTheme();
  const cellWidth = `${100 / columns}%` as `${number}%`;
  return (
    <View className="flex-row flex-wrap">
      {options.map((t) => {
        const active = t.value === value;
        return (
          <View key={t.value} style={{ width: cellWidth }} className="p-1">
            <Pressable
              onPress={() => onChange(t.value)}
              className="items-center gap-1.5 py-3.5 active:opacity-80"
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primaryWash : colors.surface1,
              }}
            >
              <Ionicons name={t.icon} size={22} color={active ? colors.primary : colors.mutedForeground} />
              <Text
                numberOfLines={1}
                className="text-xs font-medium"
                style={{ color: active ? colors.primary : colors.mutedForeground }}
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
