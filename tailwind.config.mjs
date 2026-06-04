/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#ff5548",
        "primary-dark": "#d83f36",
        accent: "#69c6bc",
        "accent-soft": "#153335",
        "background-dark": "#0b0f11",
        "surface-dark": "#12191c",
        "surface-darker": "#080c0e",
        "surface-raised": "#1a2428",
        "border-dark": "#273338",
        "border-contrast": "#4a5a60",
        "warm-muted": "#9eafb5",
      },
      fontFamily: {
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "0 16px 40px rgba(0, 8, 12, 0.34)",
        lift: "0 24px 80px rgba(0, 8, 12, 0.48)",
        inset: "inset 0 1px 0 rgba(230, 248, 250, 0.06)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
