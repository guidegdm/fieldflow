import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Carnet de Terrain (Field Worker)
        graph: { paper: "#F8F9FA", aged: "#F3F4E8", line: "#E5E7EB" },
        ink: { blue: "#1E40AF", black: "#1F2937", red: "#991B1B" },
        pencil: { DEFAULT: "#6B7280", light: "#9CA3AF" },
        tape: { yellow: "#FDE047" },
        // Terre du Kivu (Admin)
        soil: { DEFAULT: "#5C4033", light: "#8B6914", dark: "#3E2723" },
        lake: { deep: "#1B4F72", mist: "#85C1E9" },
        clay: { DEFAULT: "#C17A4E", light: "#D4A574" },
        volcanic: { ash: "#708090" },
        kivu: { paper: "#FDF5E6" },
        // Hopital de Beni (Supervisor)
        surgical: { white: "#FAFAFA" },
        scrub: { blue: "#2563EB" },
        antiseptic: { green: "#059669" },
        chart: { gray: "#64748B" },
        iodine: { brown: "#92400E" },
        // Brut Congo (Engineering)
        concrete: { DEFAULT: "#9CA3AF", dark: "#374151" },
        rebar: "#B91C1C",
        rust: "#B45309",
        starlight: "#E2E8F0",
        // Semantic
        success: { 500: "#16A34A", 600: "#15803D" },
        warning: { 500: "#D97706", 600: "#B45309" },
        danger: { 500: "#DC2626", 600: "#B91C1C" },
        info: { 500: "#2563EB" },
        // Humanitarian
        aid: { un: "#418FDE", redcross: "#D32026", wfp: "#F68B1F", navy: "#1D2746" },
      },
      fontFamily: {
        sans: ["Public Sans", "Inter", "system-ui", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
        display: ["Fraunces", "Georgia", "serif"],
        mono: ["DM Mono", "Consolas", "monospace"],
        receipt: ["Cormorant Garamond", "Georgia", "serif"],
      },
      borderRadius: { sm: "4px", md: "8px", lg: "12px", xl: "16px" },
      screens: { xs: "360px" },
      animation: {
        "sync-pulse": "syncPulse 2s ease-in-out infinite",
        "stamp-press": "stampPress 200ms ease-out forwards",
      },
      keyframes: {
        syncPulse: { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        stampPress: { "0%": { transform: "scale(1.2) rotate(-3deg)", opacity: "0" }, "100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" } },
      },
    },
  },
}
export default config
