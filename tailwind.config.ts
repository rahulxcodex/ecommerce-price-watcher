import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        obsidian: {
          DEFAULT: "#0C0D0E",
          deep: "#070808",
          card: "#141516",
          elevated: "#1A1C1E",
        },
        surface: {
          DEFAULT: "#141516",
          subtle: "#181A1C",
          hover: "#1E2023",
          border: "rgba(255, 255, 255, 0.08)",
        },
        champagne: {
          DEFAULT: "#E6D5B8",
          light: "#F4EBD9",
          muted: "#A0998C",
          faint: "#5C564D",
        },
        gold: {
          DEFAULT: "#C4A265",
          hover: "#B39255",
          faint: "rgba(196, 162, 101, 0.15)",
        },
        sage: {
          DEFAULT: "#6B8F71",
          faint: "rgba(107, 143, 113, 0.15)",
        },
        terracotta: {
          DEFAULT: "#B85C4A",
          faint: "rgba(184, 92, 74, 0.15)",
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        body: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      letterSpacing: {
        editorial: "-0.04em",
        tight: "-0.02em",
      },
    },
  },
  plugins: [],
};
export default config;
