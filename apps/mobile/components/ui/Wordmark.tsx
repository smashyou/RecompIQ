import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { LogoMark } from "@/components/ui/LogoMark";

// RecompIQ wordmark: the brand mark (matching the web logo) + "Recomp" + cyan "IQ".
// TODO(fonts): use the Space Grotesk display face once @expo-google-fonts is
// installed; currently falls back to the system font.
export function Wordmark({ size = 22 }: { size?: number }) {
  const { colors } = useTheme();
  const markSize = Math.round(size * 1.5);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Math.round(size * 0.3) }}>
      <LogoMark size={markSize} />
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
