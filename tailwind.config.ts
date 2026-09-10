import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        ground: "var(--ground)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        go: "var(--go)",
        "go-soft": "var(--go-soft)",
        maybe: "var(--maybe)",
        "maybe-soft": "var(--maybe-soft)",
        no: "var(--no)",
        "no-soft": "var(--no-soft)",
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "10px", lg: "8px", md: "8px" },
      boxShadow: { card: "var(--shadow)" },
    },
  },
  plugins: [],
} satisfies Config;
