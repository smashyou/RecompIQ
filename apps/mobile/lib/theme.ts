// Raw color tokens for places NativeWind className can't reach: SVG fills,
// StatusBar, navigation theming. Mirrors tailwind.config.js (which mirrors the
// web oklch theme). One source of truth would be nicer; for M1 we keep the two
// hex copies in sync by hand.
export const colors = {
  background: "#15181d",
  foreground: "#f4f5f7",
  muted: "#2a2e35",
  mutedForeground: "#9aa2ad",
  card: "#1c2026",
  cardForeground: "#f4f5f7",
  border: "#353b44",
  input: "#2a2e35",
  primary: "#1bb6c8",
  primaryForeground: "#0e1114",
  accent: "#38d07e",
  accentForeground: "#0e1114",
  destructive: "#e5484d",
  destructiveForeground: "#fdeceb",
  ring: "#1bb6c8",
} as const;
