import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy CSS-var tokens (for components that use var(--*))
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",

        // Sanctuary fixed palette (use as sc-* in Tailwind classes)
        "sc-bg":      "#0b0e14",
        "sc-dim":     "#10131a",
        "sc-low":     "#191c22",
        "sc-base":    "#1d2026",
        "sc-high":    "#272a31",
        "sc-highest": "#32353c",
        "sc-bright":  "#363940",
        "sc-primary": "#adc6ff",
        "sc-primary-c": "#4b8eff",
        "sc-tertiary": "#e9b3ff",
        "sc-error":    "#ffb4ab",
        "sc-on-surface": "#e1e2eb",
        "sc-on-variant": "#c1c6d7",
        "sc-outline":  "#8b90a0",
        "sc-outline-v": "#414755",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-in-out",
        "slide-up":   "slideUp 0.2s ease-out",
        "bounce-once":"bounceOnce 0.5s ease",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-out":   "fadeOut 0.25s ease-in forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        bounceOnce: {
          "0%, 100%": { transform: "scale(1)" },
          "50%":      { transform: "scale(1.2)" },
        },
        fadeOut: {
          "0%":   { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(-12px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
