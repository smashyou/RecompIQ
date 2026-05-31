/** @type {import('tailwindcss').Config} */
// NativeWind targets Tailwind v3; the web app is on Tailwind v4 (oklch theme).
// React Native can't render oklch(), so these are hex conversions of the web
// tokens in apps/web/app/globals.css — keep the two in visual sync by hand.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#15181d",
        foreground: "#f4f5f7",
        muted: "#2a2e35",
        "muted-foreground": "#9aa2ad",
        card: "#1c2026",
        "card-foreground": "#f4f5f7",
        border: "#353b44",
        input: "#2a2e35",
        primary: "#1bb6c8",
        "primary-foreground": "#0e1114",
        accent: "#38d07e",
        "accent-foreground": "#0e1114",
        destructive: "#e5484d",
        "destructive-foreground": "#fdeceb",
        ring: "#1bb6c8",
      },
      borderRadius: {
        DEFAULT: "12px",
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};
