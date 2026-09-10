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
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "14px", lg: "11px", md: "9px" },
      boxShadow: { card: "0 1px 2px rgb(36 28 43 / 0.06), 0 8px 24px -12px rgb(36 28 43 / 0.18)" },
    },
  },
  plugins: [],
} satisfies Config;
