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
        void: 'var(--color-void)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        border: 'var(--color-border)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          glow: 'var(--color-primary-glow)',
        },
        secondary: 'var(--color-secondary)',
        neon: {
          purple: 'var(--color-neon-purple)',
          blue: 'var(--color-neon-blue)',
          green: 'var(--color-neon-green)',
          amber: 'var(--color-neon-amber)',
          red: 'var(--color-neon-red)',
          cyan: 'var(--color-neon-cyan)',
        },
      },
      fontFamily: {
        sora: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      animation: {
        'opta-breathe': 'opta-breathe 8s ease-in-out infinite',
        'opta-breathe-slow': 'opta-breathe 12s ease-in-out infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
        'counter-fade': 'counter-fade 0.3s ease-out',
      },
      keyframes: {
        'opta-breathe': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        'terminal-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'counter-fade': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
