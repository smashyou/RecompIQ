import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";

// RecompIQ wordmark: a cyan mark + "Recomp" + cyan "IQ". A PNG/SVG mark can
// replace the glyph later; a styled glyph is fine for now.
// TODO(fonts): use the Space Grotesk display face once @expo-google-fonts is
// installed; currently falls back to the system font.
export function Wordmark({ size = 22 }: { size?: number }) {
  const { colors } = useTheme();
  const markSize = Math.round(size * 1.4);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Math.round(size * 0.34) }}>
      <View
        style={{
          width: markSize,
          height: markSize,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.primaryLine,
        }}
      >
        <Ionicons name="pulse" size={Math.round(markSize * 0.62)} color={colors.primary} />
      </View>
      <Text
        style={{
          fontSize: size,
          fontWeight: "600",
          letterSpacing: -size * 0.025,
          color: colors.foreground,
        }}
      >
        Recomp<Text style={{ color: colors.primary }}>IQ</Text>
      </Text>
    </View>
  );
}
