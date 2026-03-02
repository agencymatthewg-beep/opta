import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: 'var(--opta-bg)',
        surface: 'var(--opta-surface)',
        elevated: 'var(--opta-elevated)',
        border: 'var(--opta-border)',
        text: {
          primary: 'var(--opta-text-primary)',
          secondary: 'var(--opta-text-secondary)',
          muted: 'var(--opta-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--opta-primary)',
          glow: 'var(--opta-primary-glow)',
        },
        secondary: 'var(--opta-secondary)',
        neon: {
          purple: 'var(--opta-neon-purple)',
          blue: 'var(--opta-neon-blue)',
          green: 'var(--opta-neon-green)',
          amber: 'var(--opta-neon-amber)',
          red: 'var(--opta-neon-red)',
          cyan: 'var(--opta-neon-cyan)',
        },
      },
      fontFamily: {
        sora: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
