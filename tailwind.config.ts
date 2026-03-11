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
        cream: "rgb(var(--app-bg) / <alpha-value>)",
        ink: "rgb(var(--app-ink) / <alpha-value>)",
        sage: "rgb(var(--app-light) / <alpha-value>)",
        terracotta: "rgb(var(--app-main-dark) / <alpha-value>)",
        ocean: "rgb(var(--app-main) / <alpha-value>)",
        gold: "rgb(var(--app-light) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 20px 60px rgb(var(--app-main) / 0.12)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgb(var(--app-main) / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--app-main) / 0.08) 1px, transparent 1px)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.45", transform: "scale(0.98)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
