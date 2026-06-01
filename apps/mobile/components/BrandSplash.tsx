import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/lib/theme-context";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Branded launch screen — a faithful port of the web BrandSplash
// (apps/web/components/brand-splash.tsx): the mark draws on (hexagon → vital
// pulse → rising node), then the wordmark + tagline rise and a loader sweeps.
// Shown on app boot; also the visible launch screen in Expo Go (where the native
// app.json splash doesn't render).
export function BrandSplash() {
  const { colors } = useTheme();

  // Stroke-draw values (SVG props → non-native driver). Initial = the path's
  // own length so the stroke starts fully hidden, then animates to 0 (drawn).
  const HEX_LEN = 132;
  const PULSE_LEN = 72;
  const hexOffset = useRef(new Animated.Value(HEX_LEN)).current;
  const pulseOffset = useRef(new Animated.Value(PULSE_LEN)).current;
  const nodeOpacity = useRef(new Animated.Value(0)).current;
  // Transform/opacity values (native driver).
  const tile = useRef(new Animated.Value(0)).current; // 0 → 1 (scale + fade)
  const word = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const footer = useRef(new Animated.Value(0)).current;
  const loaderShow = useRef(new Animated.Value(0)).current;
  const loaderX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    // Tile scales/fades in.
    Animated.timing(tile, { toValue: 1, duration: 700, delay: 50, easing: ease, useNativeDriver: true }).start();
    // Hexagon draws, then the pulse draws.
    Animated.timing(hexOffset, { toValue: 0, duration: 750, delay: 280, easing: Easing.bezier(0.5, 0, 0.2, 1), useNativeDriver: false }).start();
    Animated.timing(pulseOffset, { toValue: 0, duration: 850, delay: 620, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: false }).start();
    // Node pops in once the pulse reaches its vertex.
    Animated.timing(nodeOpacity, { toValue: 1, duration: 400, delay: 1180, easing: ease, useNativeDriver: false }).start();
    // Wordmark + tagline rise.
    Animated.timing(word, { toValue: 1, duration: 600, delay: 1050, easing: ease, useNativeDriver: true }).start();
    Animated.timing(tag, { toValue: 1, duration: 600, delay: 1250, easing: ease, useNativeDriver: true }).start();
    // Loader appears + sweeps on a loop.
    Animated.timing(loaderShow, { toValue: 1, duration: 500, delay: 1450, easing: ease, useNativeDriver: true }).start();
    Animated.timing(footer, { toValue: 1, duration: 600, delay: 1550, easing: ease, useNativeDriver: true }).start();
    const sweep = Animated.loop(
      Animated.timing(loaderX, { toValue: 1, duration: 1600, delay: 1600, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
    );
    sweep.start();
    return () => sweep.stop();
  }, [tile, hexOffset, pulseOffset, nodeOpacity, word, tag, footer, loaderShow, loaderX]);

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ alignItems: "center", marginTop: -36 }}>
        {/* mark tile */}
        <Animated.View
          style={{
            width: 104,
            height: 104,
            borderRadius: 26,
            backgroundColor: colors.surface1,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            alignItems: "center",
            justifyContent: "center",
            opacity: tile,
            transform: [{ scale: tile.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
          }}
        >
          <Svg width={66} height={66} viewBox="0 0 64 64" fill="none">
            <Defs>
              <LinearGradient id="riSplashPulse" x1="15" y1="35" x2="51" y2="21" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#1FC2CE" />
                <Stop offset="1" stopColor="#2FDB92" />
              </LinearGradient>
            </Defs>
            <AnimatedPath
              d="M32 10 L51 21 V43 L32 54 L13 43 V21 Z"
              stroke="#3E939A"
              strokeWidth={2.6}
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${HEX_LEN}`}
              strokeDashoffset={hexOffset}
            />
            <AnimatedPath
              d="M15 35 H24 L27 35 L30 25 L33 43 L36 33 L40 33 L51 21"
              stroke="url(#riSplashPulse)"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${PULSE_LEN}`}
              strokeDashoffset={pulseOffset}
            />
            <AnimatedCircle cx={51} cy={21} r={3.6} fill="#2FDB92" opacity={nodeOpacity} />
          </Svg>
        </Animated.View>

        {/* wordmark */}
        <Animated.Text
          style={[
            { marginTop: 28, fontSize: 38, fontWeight: "700", letterSpacing: -1.1, color: colors.foreground },
            rise(word),
          ]}
        >
          Recomp<Text style={{ color: colors.primary }}>IQ</Text>
        </Animated.Text>

        {/* tagline */}
        <Animated.Text
          style={[
            { marginTop: 12, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 280, color: colors.mutedForeground },
            rise(tag),
          ]}
        >
          Evidence-graded tracking for body recomposition, metabolic health & peptide research.
        </Animated.Text>

        {/* loader */}
        <Animated.View
          style={{
            marginTop: 26,
            width: 180,
            height: 3,
            borderRadius: 999,
            backgroundColor: colors.surface2,
            overflow: "hidden",
            opacity: loaderShow,
          }}
        >
          <Animated.View
            style={{
              width: 70,
              height: 3,
              borderRadius: 999,
              backgroundColor: colors.primary,
              transform: [{ translateX: loaderX.interpolate({ inputRange: [0, 1], outputRange: [-80, 200] }) }],
            }}
          />
        </Animated.View>
      </View>

      {/* compliance footer */}
      <Animated.View style={[{ position: "absolute", bottom: 44, left: 28, right: 28, alignItems: "center", gap: 12 }, rise(footer)]}>
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
      </Animated.View>
    </View>
  );
}
