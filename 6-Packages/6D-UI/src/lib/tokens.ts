/**
 * Opta Design Token Dictionary — @opta/ui
 *
 * Single source of truth for all --opta-* CSS custom property names and their
 * canonical values. Use these constants when:
 *   - Writing CSS-in-JS (inline styles, emotion, styled-components)
 *   - Referencing var() in TypeScript to avoid string typos
 *   - Documenting expected values in shared packages
 *
 * The actual CSS declarations (--opta-bg: #09090b etc.) live in each app's
 * stylesheet (globals.css / opta.css). This file provides the TYPE-SAFE
 * vocabulary that ties all apps to the same token names and canonical values.
 */

// ─── Background / Surface ──────────────────────────────────────────────────

export const BG = {
  base: "var(--opta-bg)" as const,
  surface: "var(--opta-surface)" as const,
  elevated: "var(--opta-elevated)" as const,
} as const;

export const BG_VALUES = {
  base: "#09090b",
  surface: "#18181b",
  elevated: "#27272a",
} as const;

// ─── Border ────────────────────────────────────────────────────────────────

export const BORDER = {
  default: "var(--opta-border)" as const,
  strong: "var(--opta-border-strong)" as const,
} as const;

export const BORDER_VALUES = {
  default: "rgba(255, 255, 255, 0.05)",
  strong: "rgba(255, 255, 255, 0.15)",
} as const;

// ─── Brand / Primary ───────────────────────────────────────────────────────

export const PRIMARY = {
  base: "var(--opta-primary)" as const,
  glow: "var(--opta-primary-glow)" as const,
} as const;

export const PRIMARY_VALUES = {
  base: "#8b5cf6",   // violet-600
  glow: "#a855f7",   // violet-500
} as const;

// ─── Status / Neon ─────────────────────────────────────────────────────────

export const STATUS = {
  green: "var(--opta-neon-green)" as const,
  amber: "var(--opta-neon-amber)" as const,
  red: "var(--opta-neon-red)" as const,
  cyan: "var(--opta-neon-cyan)" as const,
} as const;

export const STATUS_VALUES = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
} as const;

// ─── Text ──────────────────────────────────────────────────────────────────

export const TEXT = {
  primary: "var(--opta-text-primary)" as const,
  secondary: "var(--opta-text-secondary)" as const,
  muted: "var(--opta-text-muted)" as const,
} as const;

export const TEXT_VALUES = {
  primary: "#fafafa",
  secondary: "#a1a1aa",
  muted: "#52525b",
} as const;

// ─── Glass ─────────────────────────────────────────────────────────────────

export const GLASS = {
  bg: "var(--opta-glass-bg)" as const,
  border: "var(--opta-glass-border)" as const,
  hover: "var(--opta-glass-hover)" as const,
} as const;

export const GLASS_VALUES = {
  bg: "rgba(109, 40, 217, 0.15)",
  border: "rgba(139, 92, 246, 0.35)",
  hover: "rgba(139, 92, 246, 0.25)",
} as const;

// ─── Blur Scales ───────────────────────────────────────────────────────────

export const BLUR = {
  sm: "var(--opta-blur-sm)" as const,
  md: "var(--opta-blur-md)" as const,
  lg: "var(--opta-blur-lg)" as const,
} as const;

export const BLUR_VALUES = {
  sm: "8px",
  md: "12px",
  lg: "20px",
} as const;

// ─── Motion ────────────────────────────────────────────────────────────────

export const DURATION = {
  fast: "var(--opta-duration-fast)" as const,
  normal: "var(--opta-duration-normal)" as const,
  slow: "var(--opta-duration-slow)" as const,
} as const;

export const DURATION_VALUES = {
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
} as const;

export const EASE = {
  smooth: "var(--opta-ease-smooth)" as const,
} as const;

export const EASE_VALUES = {
  smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

// ─── CSS Class Names ───────────────────────────────────────────────────────

/** Canonical CSS class names for glass effects. */
export const GLASS_CLASS = {
  base: "glass",
  subtle: "glass-subtle",
  strong: "glass-strong",
} as const;

// ─── Composite Export ──────────────────────────────────────────────────────

/** All CSS var() references — use in style props or CSS-in-JS. */
export const tokens = {
  bg: BG,
  border: BORDER,
  primary: PRIMARY,
  status: STATUS,
  text: TEXT,
  glass: GLASS,
  blur: BLUR,
  duration: DURATION,
  ease: EASE,
} as const;

/** All raw hex/rgba values — use when CSS variables aren't available. */
export const tokenValues = {
  bg: BG_VALUES,
  border: BORDER_VALUES,
  primary: PRIMARY_VALUES,
  status: STATUS_VALUES,
  text: TEXT_VALUES,
  glass: GLASS_VALUES,
  blur: BLUR_VALUES,
  duration: DURATION_VALUES,
  ease: EASE_VALUES,
} as const;

export type TokenName = keyof typeof tokens;
