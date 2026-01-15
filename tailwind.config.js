/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Futuristic theme colors
        primary: {
          DEFAULT: "#00f0ff", // neon cyan
          foreground: "#0a0a0f",
        },
        accent: {
          DEFAULT: "#a855f7", // electric purple
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#00ff88", // neon green (Stealth Mode)
          foreground: "#0a0a0f",
        },
        warning: {
          DEFAULT: "#f59e0b", // amber
          foreground: "#0a0a0f",
        },
        danger: {
          DEFAULT: "#ef4444", // red
          foreground: "#ffffff",
        },
        background: "#0a0a0f", // near-black
        card: {
          DEFAULT: "#111118", // dark gray
          foreground: "#fafafa",
        },
        border: "#1f1f2e", // subtle gray
        muted: {
          DEFAULT: "#1f1f2e",
          foreground: "#a1a1aa",
        },
        foreground: "#fafafa",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
