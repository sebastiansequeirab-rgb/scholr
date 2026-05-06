import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS-var tokens (componentes que usan var(--*))
        background:    "var(--background)",
        foreground:    "var(--foreground)",
        primary:       "var(--color-primary)",
        secondary:     "var(--color-secondary)",
        tertiary:      "var(--color-tertiary)",
        accent:        "var(--color-accent)",
        surface:       "var(--color-surface)",
        "surface-2":   "var(--color-surface-2)",
        border:        "var(--color-border)",
        muted:         "var(--color-muted)",
        success:       "var(--success)",
        warning:       "var(--warning)",
        danger:        "var(--danger)",
        info:          "var(--info)",

        // Surfaces (s-*)
        "s-bg":      "var(--s-bg)",
        "s-dim":     "var(--s-dim)",
        "s-low":     "var(--s-low)",
        "s-base":    "var(--s-base)",
        "s-high":    "var(--s-high)",
        "s-highest": "var(--s-highest)",
        "s-bright":  "var(--s-bright)",

        // On-colors
        "on-surface":         "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",
        "on-primary":         "var(--on-primary)",

        // Subject signature tags
        "tag-purple": "var(--tag-purple)",
        "tag-cyan":   "var(--tag-cyan)",
        "tag-green":  "var(--tag-green)",
        "tag-amber":  "var(--tag-amber)",
        "tag-rose":   "var(--tag-rose)",
        "tag-blue":   "var(--tag-blue)",
      },
      fontFamily: {
        sans:  ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["'Instrument Serif'", "'Iowan Old Style'", "Georgia", "serif"],
        mono:  ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        // Tighter editorial scale — defaults a bit smaller than Tailwind base
        xxs:  ["10px", { lineHeight: "1.4", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        sm:    "8px",
        DEFAULT: "10px",
        md:    "10px",
        lg:    "14px",
        xl:    "18px",
        "2xl": "20px",
        "3xl": "24px",
      },
      animation: {
        "fade-in":     "fadeIn 0.2s ease-out",
        "slide-up":    "slideUp 0.2s ease-out",
        "bounce-once": "bounceOnce 0.5s ease",
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-out":    "fadeOut 0.25s ease-in forwards",
        "reveal":      "reveal 0.45s ease-out forwards",
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
        reveal: {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      letterSpacing: {
        kicker: "0.16em",
      },
    },
  },
  plugins: [],
};
export default config;
