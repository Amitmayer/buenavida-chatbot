import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        pine: "var(--pine)",
        forest: "var(--forest)",
        gold: "var(--gold)",
        sage: "var(--sage)",
        overdue: "var(--overdue)",
        paper: "var(--paper)",
        sheet: "var(--sheet)",
        mist: "var(--mist)",
        field: "var(--field)",
        wash: "var(--wash)",
        hover: "var(--hover)",
        cream: "var(--cream)",
        peach: "var(--peach)",
        mute: "var(--mute)",
        line: "var(--line)",
        hair: "var(--hair)",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-plex)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      fontSize: {
        title: ["34px", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        task: ["20px", { lineHeight: "1.25", fontWeight: "600" }],
        row: ["15px", { lineHeight: "1.3", fontWeight: "500" }],
        "row-desk": ["13px", { lineHeight: "1.3", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};

export default config;
