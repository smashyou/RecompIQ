import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type ThemePreference } from "@/lib/theme-context";

// Sun / monitor / moon segmented toggle for the More/Profile header.
// `compact` shrinks it for inline header use.
const OPTIONS: ReadonlyArray<{ value: ThemePreference; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "light", icon: "sunny-outline" },
  { value: "system", icon: "desktop-outline" },
  { value: "dark", icon: "moon-outline" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference, colors } = useTheme();
  const size = compact ? 16 : 18;
  const pad = compact ? 6 : 8;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 2,
        padding: 2,
        borderRadius: 999,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={`${opt.value} theme`}
            onPress={() => setPreference(opt.value)}
            style={{
              padding: pad,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Ionicons
              name={opt.icon}
              size={size}
              color={active ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
