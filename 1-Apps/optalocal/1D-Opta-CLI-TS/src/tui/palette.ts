/**
 * Centralized TUI palette for consistent visual language.
 */
export const TUI_COLORS = {
  accent: '#8b5cf6',       // Electric Violet - Core brand identity
  accentSoft: '#a78bfa',   // Lighter violet for headers and glyphs
  border: '#4c1d95',       // Active glassmorphism borders
  borderSoft: '#312e81',   // Inactive glassmorphism borders
  prompt: '#60a5fa',       // Bright calming blue for input prompts
  info: '#22d3ee',         // Cyan for neutral system info
  success: '#10b981',      // Emerald for success/safe
  warning: '#f59e0b',      // Amber for warnings
  danger: '#ef4444',       // Rose for errors/risk
  dim: '#6b7280',          // Slate for low hierarchy text
} as const;
