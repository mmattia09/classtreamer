import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-fg) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          foreground: "rgb(var(--accent-fg) / <alpha-value>)",
          subtle: "rgb(var(--accent-subtle) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          subtle: "rgb(var(--success-subtle) / <alpha-value>)",
          foreground: "rgb(var(--success-fg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          subtle: "rgb(var(--warning-subtle) / <alpha-value>)",
          foreground: "rgb(var(--warning-fg) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          subtle: "rgb(var(--destructive-subtle) / <alpha-value>)",
          foreground: "rgb(var(--destructive-fg) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        xs: "0 1px 2px rgb(0 0 0 / 0.05)",
        sm: "0 1px 3px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.06)",
        DEFAULT: "0 4px 6px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.06)",
        md: "0 6px 16px rgb(0 0 0 / 0.08), 0 2px 6px rgb(0 0 0 / 0.05)",
        lg: "0 12px 32px rgb(0 0 0 / 0.10), 0 4px 12px rgb(0 0 0 / 0.06)",
        xl: "0 24px 56px rgb(0 0 0 / 0.12), 0 8px 20px rgb(0 0 0 / 0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.25s ease-out",
        "bar-grow": "barGrow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "word-in": "wordIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        barGrow: {
          from: { transform: "scaleY(0)", transformOrigin: "bottom" },
          to: { transform: "scaleY(1)", transformOrigin: "bottom" },
        },
        wordIn: {
          from: { opacity: "0", transform: "scale(0.6)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
