// RecompIQ design tokens for React Native.
//
// React Native cannot render oklch() or light-dark(), so we ship hand-converted
// hex/rgba sets for BOTH themes, derived from the design handoff
// (Design/design_handoff_recompiq/colors_and_type.css). The dark side is the
// brand's primary mode. Cyan/green accents use the logo literals
// (#1FC2CE / #2FDB92) so mobile stays consistent with web.
//
// `colors` is a LIVE object (mutated by lib/theme-context.tsx when the active
// scheme changes) so that modules importing it at load time — SVG fills,
// StatusBar, navigation theming — always read the current scheme's values.
// className-driven UI uses the static Tailwind palette (tailwind.config.js),
// which mirrors the DARK set; light mode is driven via the theme context +
// inline styles where a class can't reach.

export type ColorScheme = "light" | "dark";

// Full depth/state/evidence scale, both themes.
export interface ThemeTokens {
  // neutrals
  bgDeep: string;
  background: string;
  surface1: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  // text
  foreground: string;
  mutedForeground: string;
  fgSubtle: string;
  fgFaint: string;
  // primary (cyan/teal)
  primary: string;
  primaryBright: string;
  primaryDim: string;
  primaryForeground: string;
  primaryWash: string;
  primaryLine: string;
  // positive (green)
  positive: string;
  positiveDim: string;
  positiveForeground: string;
  positiveWash: string;
  positiveLine: string;
  // caution (amber)
  warn: string;
  warnDim: string;
  warnForeground: string;
  warnWash: string;
  warnLine: string;
  // danger (red)
  danger: string;
  dangerBright: string;
  dangerForeground: string;
  dangerWash: string;
  dangerLine: string;
  // evidence-grade scale
  evFda: string;
  evRct: string;
  evObs: string;
  evAnimal: string;
  evMech: string;
  evAnecdotal: string;
  // data-viz
  vizMa: string;
  vizTarget: string;
  vizConservative: string;
  vizGrid: string;

  // ---- back-compat aliases (existing components import these names) ----
  muted: string; // = surface2 (inputs/hover surface)
  card: string; // = surface1
  cardForeground: string; // = foreground
  input: string; // = surface2
  accent: string; // = positive (brand green)
  accentForeground: string; // = positiveForeground
  destructive: string; // = danger
  destructiveForeground: string; // = dangerForeground
  ring: string; // = primary
}

// Brand logo literals — keep cyan/green identical to web wordmark.
const BRAND_CYAN = "#1FC2CE";
const BRAND_GREEN = "#2FDB92";

export const dark: ThemeTokens = {
  bgDeep: "#04080b",
  background: "#0b1014",
  surface1: "#13191e",
  surface2: "#1c2327",
  surface3: "#262c31",
  border: "#292f33",
  borderStrong: "#42494e",

  foreground: "#f3f5f7",
  mutedForeground: "#a4acb2",
  fgSubtle: "#747b81",
  fgFaint: "#52595e",

  primary: BRAND_CYAN,
  primaryBright: "#12e0d8",
  primaryDim: "#007a7c",
  primaryForeground: "#040c12",
  primaryWash: "rgba(31, 194, 206, 0.12)",
  primaryLine: "rgba(31, 194, 206, 0.40)",

  positive: BRAND_GREEN,
  positiveDim: "#348f4f",
  positiveForeground: "#060e07",
  positiveWash: "rgba(47, 219, 146, 0.12)",
  positiveLine: "rgba(47, 219, 146, 0.40)",

  warn: "#f9b13e",
  warnDim: "#b47825",
  warnForeground: "#120c04",
  warnWash: "rgba(249, 177, 62, 0.12)",
  warnLine: "rgba(249, 177, 62, 0.40)",

  danger: "#ed4a49",
  dangerBright: "#ff5957",
  dangerForeground: "#fff6f5",
  dangerWash: "rgba(237, 74, 73, 0.12)",
  dangerLine: "rgba(237, 74, 73, 0.40)",

  evFda: "#56db8f",
  evRct: "#29d5a5",
  evObs: BRAND_CYAN,
  evAnimal: "#61b7de",
  evMech: "#87a1bd",
  evAnecdotal: "#d47452",

  vizMa: "#3adfd7",
  vizTarget: "#b18bf5",
  vizConservative: "#e6b13e",
  vizGrid: "rgba(41, 47, 51, 0.6)",

  muted: "#1c2327",
  card: "#13191e",
  cardForeground: "#f3f5f7",
  input: "#1c2327",
  accent: BRAND_GREEN,
  accentForeground: "#060e07",
  destructive: "#ed4a49",
  destructiveForeground: "#fff6f5",
  ring: BRAND_CYAN,
};

export const light: ThemeTokens = {
  bgDeep: "#ebeff2",
  background: "#f8fafc",
  surface1: "#ffffff",
  surface2: "#f1f4f6",
  surface3: "#e3e9ed",
  border: "#d9dfe3",
  borderStrong: "#b1b9be",

  foreground: "#172128",
  mutedForeground: "#4a545c",
  fgSubtle: "#6d767c",
  fgFaint: "#999fa4",

  primary: "#00969f",
  primaryBright: "#007d89",
  primaryDim: "#48b8bb",
  primaryForeground: "#f8fdfd",
  primaryWash: "rgba(0, 150, 159, 0.10)",
  primaryLine: "rgba(0, 150, 159, 0.28)",

  positive: "#05893e",
  positiveDim: "#63b376",
  positiveForeground: "#f9fdfa",
  positiveWash: "rgba(5, 137, 62, 0.12)",
  positiveLine: "rgba(5, 137, 62, 0.30)",

  warn: "#bc7300",
  warnDim: "#cf8f43",
  warnForeground: "#fefbf8",
  warnWash: "rgba(188, 115, 0, 0.14)",
  warnLine: "rgba(188, 115, 0, 0.32)",

  danger: "#d01d21",
  dangerBright: "#ba0000",
  dangerForeground: "#fff9f8",
  dangerWash: "rgba(208, 29, 33, 0.10)",
  dangerLine: "rgba(208, 29, 33, 0.30)",

  evFda: "#008140",
  evRct: "#00805a",
  evObs: "#00878f",
  evAnimal: "#2477a0",
  evMech: "#52657a",
  evAnecdotal: "#bb4717",

  vizMa: "#00878f",
  vizTarget: "#7c3fd4",
  vizConservative: "#b8851f",
  vizGrid: "rgba(184, 191, 196, 0.7)",

  muted: "#f1f4f6",
  card: "#ffffff",
  cardForeground: "#172128",
  input: "#f1f4f6",
  accent: "#05893e",
  accentForeground: "#f9fdfa",
  destructive: "#d01d21",
  destructiveForeground: "#fff9f8",
  ring: "#00969f",
};

export const themes: Record<ColorScheme, ThemeTokens> = { light, dark };

// ---- NativeWind runtime theming ----------------------------------------
// tailwind.config.js declares every color as `var(--color-*)`. This builds the
// matching CSS-variable map for a scheme; lib/theme-context.tsx feeds it to
// NativeWind's `vars()` at the app root so EVERY className color (bg-card,
// text-foreground, border-border, …) resolves to the active scheme's hex.
// The keys here MUST match the `var(--color-*)` names in tailwind.config.js.
export function varsForScheme(scheme: ColorScheme): Record<string, string> {
  const t = themes[scheme];
  return {
    "--color-bg-deep": t.bgDeep,
    "--color-background": t.background,
    "--color-surface-1": t.surface1,
    "--color-surface-2": t.surface2,
    "--color-surface-3": t.surface3,
    "--color-border": t.border,
    "--color-border-strong": t.borderStrong,

    "--color-foreground": t.foreground,
    "--color-muted-foreground": t.mutedForeground,
    "--color-fg-subtle": t.fgSubtle,
    "--color-fg-faint": t.fgFaint,

    "--color-primary": t.primary,
    "--color-primary-bright": t.primaryBright,
    "--color-primary-dim": t.primaryDim,
    "--color-primary-foreground": t.primaryForeground,
    "--color-primary-wash": t.primaryWash,
    "--color-primary-line": t.primaryLine,

    "--color-positive": t.positive,
    "--color-positive-dim": t.positiveDim,
    "--color-positive-foreground": t.positiveForeground,
    "--color-positive-wash": t.positiveWash,
    "--color-positive-line": t.positiveLine,

    "--color-warn": t.warn,
    "--color-warn-dim": t.warnDim,
    "--color-warn-foreground": t.warnForeground,
    "--color-warn-wash": t.warnWash,
    "--color-warn-line": t.warnLine,

    "--color-danger": t.danger,
    "--color-danger-bright": t.dangerBright,
    "--color-danger-foreground": t.dangerForeground,
    "--color-danger-wash": t.dangerWash,
    "--color-danger-line": t.dangerLine,

    "--color-ev-fda": t.evFda,
    "--color-ev-rct": t.evRct,
    "--color-ev-obs": t.evObs,
    "--color-ev-animal": t.evAnimal,
    "--color-ev-mech": t.evMech,
    "--color-ev-anecdotal": t.evAnecdotal,

    "--color-muted": t.muted,
    "--color-card": t.card,
    "--color-card-foreground": t.cardForeground,
    "--color-input": t.input,
    "--color-accent": t.accent,
    "--color-accent-foreground": t.accentForeground,
    "--color-destructive": t.destructive,
    "--color-destructive-foreground": t.destructiveForeground,
    "--color-ring": t.ring,
  };
}

// Live, mutable active palette. Defaults to dark (the brand's primary mode).
// lib/theme-context.tsx calls applyScheme() to swap the values in place so
// every static `import { colors }` reflects the active scheme.
export const colors: ThemeTokens = { ...dark };

export function applyScheme(scheme: ColorScheme): void {
  Object.assign(colors, themes[scheme]);
}

// Control radii (px) from the handoff.
export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;
