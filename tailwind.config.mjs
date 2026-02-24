/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#ec1313",
        "primary-dark": "#cc0000",
        "background-light": "#f8f6f6",
        "background-dark": "#0A0D15",
        "surface-dark": "#0a0a0a",
        "surface-darker": "#050505",
        "border-dark": "#2a2a2a",
        "border-contrast": "#000000",
      },
      fontFamily: {
        display: ["Roboto", "sans-serif"],
        mono: [
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
