/**
 * RecompIQ email palette — email-safe hex.
 *
 * Email clients cannot resolve CSS variables, `light-dark()`, or `oklch()`, so
 * these are fixed hex conversions of the DARK side of the design tokens in
 * Design/design_handoff_recompiq/colors_and_type.css (the visual source of
 * truth), with the cyan/green accents taken verbatim from the logo gradient
 * (#1FC2CE -> #2FDB92) for brand consistency.
 *
 * The brand is dark-first; emails bake this dark palette in directly. The
 * `colorScheme` meta hints (see Layout) keep dark-mode clients from
 * re-inverting it. Wash/line values are pre-blended over `surface1` so they
 * render as solid hex (old Outlook ignores rgba()).
 */
export const palette = {
  // Surfaces (cool slate, hue ~240)
  bgDeep: "#121419", // outer email body
  bg: "#16191f", // inner frame
  surface1: "#1c2026", // cards / panels
  surface2: "#23272f", // insets, code, quiet rows
  surface3: "#2a2f37", // pressed / nested
  border: "#30343c", // hairline dividers
  borderStrong: "#454b55", // emphasized edges

  // Text
  fg: "#f4f5f7", // primary
  fgMuted: "#b3b8c1", // secondary / body
  fgSubtle: "#888e98", // tertiary / captions
  fgFaint: "#686e79", // disabled / fine print

  // Primary — cyan/teal (logo)
  primary: "#1FC2CE",
  primaryBright: "#46d4de", // hover / link emphasis
  primaryDim: "#178b94",
  primaryFg: "#0b1013", // text on a primary fill
  primaryWash: "#1b323a", // 12% cyan over surface1
  primaryLine: "#1d6169", // 40% cyan over surface1

  // Positive — green (on-track, fat loss) (logo)
  positive: "#2FDB92",
  positiveDim: "#1f9c67",
  positiveFg: "#08130d",
  positiveWash: "#1e3633",
  positiveLine: "#246b51",

  // Caution — amber
  warn: "#E9A93A",
  warnFg: "#171205",
  warnWash: "#353028",
  warnLine: "#6e572e",

  // Danger — red
  danger: "#E5484D",
  dangerBright: "#f0635f",
  dangerFg: "#ffffff",
  dangerWash: "#34252b",
  dangerLine: "#6c3036",

  // Evidence-grade scale (dark side of the design tokens)
  evFda: "#36c98a",
  evRct: "#2fd0ab",
  evObs: "#3cc6d2",
  evAnimal: "#5fa8e6",
  evMech: "#9aa1b8",
  evAnecdotal: "#d98a5a",
} as const;

export type Palette = typeof palette;

/** Radii (px) from the design tokens. */
export const radius = {
  sm: 6,
  md: 10, // controls
  lg: 14, // cards
  xl: 20,
  pill: 999,
} as const;

/** 4px spacing scale. */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
} as const;

/**
 * Font stacks. Space Grotesk / IBM Plex won't load in most mail clients, so
 * these degrade to high-quality system fonts. The cyan "IQ" in the wordmark
 * still reads regardless of face.
 */
export const fonts = {
  display:
    '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  sans: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace',
} as const;
