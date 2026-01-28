import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // The Void - Obsidian Standard v2.0 (OLED optimized)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Obsidian Surfaces
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        // The Energy - Primary Brand (50% Opta Glow)
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },

        // Dormant Violet - 0% State
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        // Accent
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        // Functional States
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        // Muted
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        // Borders
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Neon Accents - USE SPARINGLY (active states only)
        // Per Gemini: "Neon for active states only"
        neon: {
          purple: "rgb(var(--neon-purple) / <alpha-value>)",
          blue: "rgb(var(--neon-blue) / <alpha-value>)",
          green: "rgb(var(--neon-green) / <alpha-value>)",
          amber: "rgb(var(--neon-amber) / <alpha-value>)",
          red: "rgb(var(--neon-red) / <alpha-value>)",
          cyan: "rgb(var(--neon-cyan) / <alpha-value>)",
        },
      },

      // Typography - Sora (The Obsidian Standard)
      fontFamily: {
        sans: [
          "Sora",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        sora: ["Sora", "sans-serif"],
      },

      // Border radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // Box shadows - Glow System
      boxShadow: {
        // Obsidian Standard Glows
        "glow-sm": "0 0 8px 0 rgba(168, 85, 247, 0.3)",
        "glow": "0 0 16px 0 rgba(168, 85, 247, 0.4)",
        "glow-md": "0 0 16px 0 rgba(168, 85, 247, 0.4)",
        "glow-lg": "0 0 24px 4px rgba(168, 85, 247, 0.5)",
        "glow-intense": "0 0 40px -10px rgba(168, 85, 247, 0.5)",
        "glow-beam": "0 0 80px -20px rgba(168, 85, 247, 0.3)",

        // Success state glows
        "glow-sm-success": "0 0 8px 0 hsl(var(--success) / 0.3)",
        "glow-success": "0 0 16px 0 hsl(var(--success) / 0.4)",
        "glow-lg-success": "0 0 24px 4px hsl(var(--success) / 0.5)",

        // Warning state glows
        "glow-sm-warning": "0 0 8px 0 hsl(var(--warning) / 0.3)",
        "glow-warning": "0 0 16px 0 hsl(var(--warning) / 0.4)",
        "glow-lg-warning": "0 0 24px 4px hsl(var(--warning) / 0.5)",

        // Danger state glows
        "glow-sm-danger": "0 0 8px 0 hsl(var(--danger) / 0.3)",
        "glow-danger": "0 0 16px 0 hsl(var(--danger) / 0.4)",
        "glow-lg-danger": "0 0 24px 4px hsl(var(--danger) / 0.5)",

        // Obsidian inner glow (for cards)
        "obsidian-inner": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "obsidian-active": "inset 0 0 30px rgba(168, 85, 247, 0.15), 0 0 25px rgba(168, 85, 247, 0.4)",
      },

      // Animations
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ignition": "ignition 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
        "ring-breathe": "ringBreathe 3s ease-in-out infinite",
        "ring-process": "ringProcess 1.5s ease-in-out infinite",
        "fog-drift": "fogDrift 30s ease-in-out infinite",
        "fog-drift-fast": "fogDriftFast 15s ease-in-out infinite",
      },

      keyframes: {
        ignition: {
          from: {
            opacity: "0",
            transform: "translateY(8px) scale(0.98)",
            filter: "brightness(0.5) blur(4px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0) scale(1)",
            filter: "brightness(1) blur(0px)",
          },
        },
        ringBreathe: {
          "0%, 100%": {
            filter: "brightness(0.6) drop-shadow(0 0 10px rgba(168, 85, 247, 0.2))",
          },
          "50%": {
            filter: "brightness(1) drop-shadow(0 0 30px rgba(168, 85, 247, 0.6))",
          },
        },
        ringProcess: {
          "0%, 100%": {
            filter: "brightness(0.7) drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))",
            transform: "scale(1)",
          },
          "50%": {
            filter: "brightness(1.1) drop-shadow(0 0 40px rgba(168, 85, 247, 0.7))",
            transform: "scale(1.02)",
          },
        },
        fogDrift: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(20px, -10px)" },
          "50%": { transform: "translate(-10px, 15px)" },
          "75%": { transform: "translate(-20px, -5px)" },
        },
        fogDriftFast: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(30px, -20px)" },
          "66%": { transform: "translate(-25px, 15px)" },
        },
      },

      // Backdrop blur
      backdropBlur: {
        xs: "2px",
        "2xl": "32px",
        "3xl": "48px",
      },

      // Transition timing functions (Obsidian easing curves)
      transitionTimingFunction: {
        "smooth-out": "cubic-bezier(0.22, 1, 0.36, 1)",
        "heavy": "cubic-bezier(0.16, 1, 0.3, 1)",
        "snappy": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "cinematic": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
