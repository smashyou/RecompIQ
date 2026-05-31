/** @type {import('tailwindcss').Config} */
// NativeWind targets Tailwind v3; the web app is on Tailwind v4 (oklch theme).
// React Native can't render oklch(), so colors are hex/rgba conversions of the
// design handoff (Design/design_handoff_recompiq/colors_and_type.css).
//
// RUNTIME THEMING: every color below is a CSS custom property `var(--color-*)`.
// The actual hex values live in lib/theme.ts (`light` / `dark` token sets) and
// are applied at the app root via NativeWind's `vars()` (see app/_layout.tsx →
// lib/theme-context.tsx `varsForScheme`). Because className colors resolve the
// var from the nearest ancestor that set it, toggling Light/Dark reskins EVERY
// className-styled element. Inline `useTheme().colors` styling reads the same
// token set, so the two stay in sync. The `var(--color-*)` name here must match
// a key in lib/theme.ts `varsForScheme()`.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // neutrals
        "bg-deep": "var(--color-bg-deep)",
        background: "var(--color-background)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        // text
        foreground: "var(--color-foreground)",
        "muted-foreground": "var(--color-muted-foreground)",
        "fg-subtle": "var(--color-fg-subtle)",
        "fg-faint": "var(--color-fg-faint)",
        // primary (cyan)
        primary: "var(--color-primary)",
        "primary-bright": "var(--color-primary-bright)",
        "primary-dim": "var(--color-primary-dim)",
        "primary-foreground": "var(--color-primary-foreground)",
        "primary-wash": "var(--color-primary-wash)",
        "primary-line": "var(--color-primary-line)",
        // positive (green)
        positive: "var(--color-positive)",
        "positive-dim": "var(--color-positive-dim)",
        "positive-foreground": "var(--color-positive-foreground)",
        "positive-wash": "var(--color-positive-wash)",
        "positive-line": "var(--color-positive-line)",
        // caution (amber)
        warn: "var(--color-warn)",
        "warn-dim": "var(--color-warn-dim)",
        "warn-foreground": "var(--color-warn-foreground)",
        "warn-wash": "var(--color-warn-wash)",
        "warn-line": "var(--color-warn-line)",
        // danger (red)
        danger: "var(--color-danger)",
        "danger-bright": "var(--color-danger-bright)",
        "danger-foreground": "var(--color-danger-foreground)",
        "danger-wash": "var(--color-danger-wash)",
        "danger-line": "var(--color-danger-line)",
        // evidence-grade scale
        "ev-fda": "var(--color-ev-fda)",
        "ev-rct": "var(--color-ev-rct)",
        "ev-obs": "var(--color-ev-obs)",
        "ev-animal": "var(--color-ev-animal)",
        "ev-mech": "var(--color-ev-mech)",
        "ev-anecdotal": "var(--color-ev-anecdotal)",
        // ---- back-compat aliases (existing className usage) ----
        muted: "var(--color-muted)",
        card: "var(--color-card)",
        "card-foreground": "var(--color-card-foreground)",
        input: "var(--color-input)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-foreground)",
        destructive: "var(--color-destructive)",
        "destructive-foreground": "var(--color-destructive-foreground)",
        ring: "var(--color-ring)",
      },
      borderRadius: {
        DEFAULT: "10px",
        xl: "20px",
        lg: "14px",
        md: "10px",
        sm: "6px",
        xs: "4px",
      },
    },
  },
  plugins: [],
};
