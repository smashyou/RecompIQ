import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

// RecompIQ brand mark — a 1:1 port of apps/web/public/logo-mark.svg:
// a hexagon outline + a gradient "pulse" line (#1FC2CE → #2FDB92) + an end dot.
// Replaces the old placeholder glyph so mobile matches the web brand exactly.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="riPulse" x1="15" y1="35" x2="51" y2="21" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#1FC2CE" />
          <Stop offset="1" stopColor="#2FDB92" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 10 L51 21 V43 L32 54 L13 43 V21 Z"
        stroke="#3E939A"
        strokeWidth={2.6}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M15 35 H24 L27 35 L30 25 L33 43 L36 33 L40 33 L51 21"
        stroke="url(#riPulse)"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={51} cy={21} r={3.6} fill="#2FDB92" />
    </Svg>
  );
}
