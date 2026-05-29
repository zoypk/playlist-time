/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#e24c43",
        "primary-dark": "#bf3933",
        "background-dark": "#11100f",
        "surface-dark": "#171615",
        "surface-darker": "#0d0c0b",
        "surface-raised": "#211f1d",
        "border-dark": "#37312d",
        "border-contrast": "#5f5149",
        "warm-muted": "#a79c91",
      },
      fontFamily: {
        sans: [
          "Outfit",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "Outfit",
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
        soft: "0 16px 40px rgba(4, 3, 2, 0.36)",
        lift: "0 24px 80px rgba(8, 5, 3, 0.44)",
        inset: "inset 0 1px 0 rgba(255, 244, 232, 0.05)",
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
