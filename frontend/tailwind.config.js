/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          950: "#08090c",
          900: "#0d0f14",
          850: "#12141b",
          800: "#181b24",
          700: "#242833",
          600: "#343a48",
        },
        accent: {
          DEFAULT: "#6ee7c8",
          dim: "#3fb896",
        },
        warn: "#f5a35c",
        danger: "#f0665f",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(110,231,200,0.15), 0 8px 24px -8px rgba(110,231,200,0.25)",
      },
    },
  },
  plugins: [],
};
