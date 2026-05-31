/** @type {import('tailwindcss').Config} */
// NativeWind targets Tailwind v3; the web app is on Tailwind v4 (oklch theme).
// React Native can't render oklch() and NativeWind compiles a STATIC palette, so
// these are hex/rgba conversions of the design handoff
// (Design/design_handoff_recompiq/colors_and_type.css). The DARK set is the
// Tailwind default (brand primary mode); runtime light/dark is driven by
// lib/theme-context.tsx + inline styles via lib/theme.ts where a class can't
// reach. Keep the two (this file + lib/theme.ts `dark`) in visual sync by hand.
//
// Brand cyan/green use the logo literals #1FC2CE / #2FDB92 to match web.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // neutrals
        "bg-deep": "#04080b",
        background: "#0b1014",
        "surface-1": "#13191e",
        "surface-2": "#1c2327",
        "surface-3": "#262c31",
        border: "#292f33",
        "border-strong": "#42494e",
        // text
        foreground: "#f3f5f7",
        "muted-foreground": "#a4acb2",
        "fg-subtle": "#747b81",
        "fg-faint": "#52595e",
        // primary (cyan)
        primary: "#1FC2CE",
        "primary-bright": "#12e0d8",
        "primary-dim": "#007a7c",
        "primary-foreground": "#040c12",
        "primary-wash": "rgba(31, 194, 206, 0.12)",
        "primary-line": "rgba(31, 194, 206, 0.40)",
        // positive (green)
        positive: "#2FDB92",
        "positive-dim": "#348f4f",
        "positive-foreground": "#060e07",
        "positive-wash": "rgba(47, 219, 146, 0.12)",
        "positive-line": "rgba(47, 219, 146, 0.40)",
        // caution (amber)
        warn: "#f9b13e",
        "warn-dim": "#b47825",
        "warn-foreground": "#120c04",
        "warn-wash": "rgba(249, 177, 62, 0.12)",
        "warn-line": "rgba(249, 177, 62, 0.40)",
        // danger (red)
        danger: "#ed4a49",
        "danger-bright": "#ff5957",
        "danger-foreground": "#fff6f5",
        "danger-wash": "rgba(237, 74, 73, 0.12)",
        "danger-line": "rgba(237, 74, 73, 0.40)",
        // evidence-grade scale
        "ev-fda": "#56db8f",
        "ev-rct": "#29d5a5",
        "ev-obs": "#1FC2CE",
        "ev-animal": "#61b7de",
        "ev-mech": "#87a1bd",
        "ev-anecdotal": "#d47452",
        // ---- back-compat aliases (existing className usage) ----
        muted: "#1c2327",
        card: "#13191e",
        "card-foreground": "#f3f5f7",
        input: "#1c2327",
        accent: "#2FDB92",
        "accent-foreground": "#060e07",
        destructive: "#ed4a49",
        "destructive-foreground": "#fff6f5",
        ring: "#1FC2CE",
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
