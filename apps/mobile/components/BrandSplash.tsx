import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { LogoMark } from "@/components/ui/LogoMark";

// Branded launch screen shown briefly on app boot. Mirrors the web BrandSplash
// (mark + wordmark + tagline + verbatim compliance disclaimer) on the dark
// instrument background. Also doubles as the native-splash fallback in Expo Go,
// where the configured app.json splash doesn't render.
export function BrandSplash() {
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Animated.View style={{ alignItems: "center", opacity: fade, transform: [{ translateY: rise }] }}>
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 26,
            backgroundColor: colors.surface1,
            borderWidth: 1,
            borderColor: colors.borderStrong ?? colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LogoMark size={62} />
        </View>
        <Text style={{ marginTop: 26, fontSize: 36, fontWeight: "700", letterSpacing: -1, color: colors.foreground }}>
          Recomp<Text style={{ color: colors.primary }}>IQ</Text>
        </Text>
        <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 280, color: colors.mutedForeground }}>
          Evidence-graded tracking for body recomposition, metabolic health & peptide research.
        </Text>
      </Animated.View>

      <View style={{ position: "absolute", bottom: 44, left: 28, right: 28, alignItems: "center", gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.primaryLine,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1.6, textTransform: "uppercase", color: colors.primary }}>
            18+ · Educational & research use only
          </Text>
        </View>
        <Text style={{ fontSize: 11.5, lineHeight: 17, textAlign: "center", color: colors.mutedForeground }}>
          <Text style={{ fontWeight: "600", color: colors.foreground }}>
            For educational and research purposes only. Not medical advice.
          </Text>{" "}
          RecompIQ does not prescribe, sell, supply, or recommend any compound. Always consult a
          licensed clinician.
        </Text>
      </View>
    </View>
  );
}
