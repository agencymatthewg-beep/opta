/**
 * Animation Timing Constants - Visual Polish & QA Phase
 *
 * Standardized duration and timing values for consistent animation feel.
 * These values should be used throughout the codebase to ensure
 * visual consistency across all animated elements.
 *
 * IMPORTANT: Per Design System, prefer springs over duration-based animations
 * for interactive elements. These durations are for:
 * - CSS transitions where springs aren't available
 * - Non-interactive animations (loaders, ambient effects)
 * - Coordinated animation sequences
 *
 * @see DESIGN_SYSTEM.md - Part 5: Animation Presets
 * @see springs.ts - For physics-based spring presets
 */

// =============================================================================
// DURATION CONSTANTS (in milliseconds)
// =============================================================================

/**
 * Standard duration tiers
 *
 * | Tier       | Duration | Use Case                                    |
 * |------------|----------|---------------------------------------------|
 * | instant    | 0ms      | Reduced motion, immediate feedback          |
 * | micro      | 100ms    | Micro-interactions, subtle state changes    |
 * | fast       | 150ms    | Quick feedback, small element transitions   |
 * | normal     | 300ms    | Standard UI transitions, content updates    |
 * | slow       | 500ms    | Page transitions, complex animations        |
 * | dramatic   | 800ms    | Hero reveals, ignition sequences            |
 */
export const DURATION = {
  /** 0ms - Instant, for reduced motion or immediate changes */
  instant: 0,
  /** 100ms - Micro-interactions, hover states */
  micro: 100,
  /** 150ms - Fast feedback, toggle states, small elements */
  fast: 150,
  /** 300ms - Standard transitions, content updates */
  normal: 300,
  /** 500ms - Slow, deliberate animations, page transitions */
  slow: 500,
  /** 800ms - Dramatic reveals, ignition sequences */
  dramatic: 800,
  /** 1500ms - Processing loops, breathing animations */
  processing: 1500,
  /** 3000ms - Ambient breathing, fog drift */
  ambient: 3000,
} as const;

/**
 * Duration in seconds (for Framer Motion)
 * Framer Motion uses seconds, not milliseconds
 */
export const DURATION_SECONDS = {
  instant: 0,
  micro: 0.1,
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  dramatic: 0.8,
  processing: 1.5,
  ambient: 3,
} as const;

// =============================================================================
// DELAY CONSTANTS
// =============================================================================

/**
 * Standard delay values for staggered animations
 */
export const DELAY = {
  /** 0ms - No delay */
  none: 0,
  /** 50ms - Minimal delay for close sequences */
  micro: 50,
  /** 100ms - Short delay between related elements */
  short: 100,
  /** 200ms - Medium delay for distinct elements */
  medium: 200,
  /** 300ms - Long delay for separate sections */
  long: 300,
} as const;

/**
 * Delay in seconds (for Framer Motion)
 */
export const DELAY_SECONDS = {
  none: 0,
  micro: 0.05,
  short: 0.1,
  medium: 0.2,
  long: 0.3,
} as const;

// =============================================================================
// EASING CURVES
// =============================================================================

/**
 * Standard easing curves (cubic-bezier values)
 *
 * Per Gemini research: Use smooth, decelerating curves for premium feel.
 * Avoid linear easing for UI elements (feels robotic).
 *
 * Exception: Linear is OK for:
 * - Infinite looping animations (spinners, progress)
 * - Continuous motion effects
 */
export const EASING = {
  /** Standard smooth deceleration - default for most UI */
  smoothOut: [0.22, 1, 0.36, 1] as const,

  /** Heavy/weighty - ring movements, large elements */
  heavy: [0.16, 1, 0.3, 1] as const,

  /** Snappy with slight overshoot - hover states, toggles */
  snappy: [0.34, 1.56, 0.64, 1] as const,

  /** Cinematic entrance - page reveals, hero content */
  cinematic: [0.77, 0, 0.175, 1] as const,

  /** Circle out - content exits */
  circOut: [0, 0.55, 0.45, 1] as const,

  /** Ease in-out - symmetric, for ambient loops */
  easeInOut: [0.42, 0, 0.58, 1] as const,

  /** Linear - ONLY for infinite loops (spinners, progress bars) */
  linear: [0, 0, 1, 1] as const,
} as const;

/**
 * Framer Motion-compatible easing (string or array)
 */
export const FRAMER_EASING = {
  smoothOut: EASING.smoothOut,
  heavy: EASING.heavy,
  snappy: EASING.snappy,
  cinematic: EASING.cinematic,
  circOut: EASING.circOut,
  easeInOut: 'easeInOut' as const,
  linear: 'linear' as const,
} as const;

// =============================================================================
// COMPOSITE TRANSITIONS
// =============================================================================

/**
 * Pre-built transition objects for common use cases
 * Ready to spread into Framer Motion transition props
 */
export const transitions = {
  /** Fast, snappy - buttons, toggles, small elements */
  fast: {
    duration: DURATION_SECONDS.fast,
    ease: EASING.smoothOut,
  },

  /** Normal UI transition */
  normal: {
    duration: DURATION_SECONDS.normal,
    ease: EASING.smoothOut,
  },

  /** Slow, deliberate - page transitions, modals */
  slow: {
    duration: DURATION_SECONDS.slow,
    ease: EASING.smoothOut,
  },

  /** Dramatic entrance - hero content, ignition */
  dramatic: {
    duration: DURATION_SECONDS.dramatic,
    ease: EASING.cinematic,
  },

  /** Processing loop - loading states */
  processing: {
    duration: DURATION_SECONDS.processing,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },

  /** Ambient loop - breathing, fog */
  ambient: {
    duration: DURATION_SECONDS.ambient,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },

  /** Spinner/infinite rotation - linear for smooth spin */
  spin: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear' as const,
  },

  /** Instant - reduced motion fallback */
  instant: {
    duration: 0,
  },
} as const;

// =============================================================================
// CSS TRANSITION HELPERS
// =============================================================================

/**
 * CSS transition string builders
 * For use in className or style props where Framer Motion isn't available
 */
export const cssTransition = {
  /** `transition-all duration-150 ease-out` */
  fast: 'transition-all duration-150 ease-out',
  /** `transition-all duration-300 ease-out` */
  normal: 'transition-all duration-300 ease-out',
  /** `transition-all duration-500 ease-out` */
  slow: 'transition-all duration-500 ease-out',
  /** `transition-colors duration-200` */
  colors: 'transition-colors duration-200',
  /** `transition-opacity duration-200` */
  opacity: 'transition-opacity duration-200',
  /** `transition-transform duration-200` */
  transform: 'transition-transform duration-200',
} as const;

// =============================================================================
// VALIDATION & HELPERS
// =============================================================================

/**
 * Type for duration tier names
 */
export type DurationTier = keyof typeof DURATION;

/**
 * Get duration in seconds for Framer Motion
 */
export function getDuration(tier: DurationTier): number {
  return DURATION[tier] / 1000;
}

/**
 * Get delay in seconds for Framer Motion
 */
export function getDelay(tier: keyof typeof DELAY): number {
  return DELAY[tier] / 1000;
}

/**
 * Calculate stagger delay for a specific index
 */
export function getStaggerDelay(
  index: number,
  staggerMs: number = DELAY.micro,
  initialDelayMs: number = DELAY.none
): number {
  return (initialDelayMs + index * staggerMs) / 1000;
}

/**
 * Get appropriate transition based on reduced motion preference
 */
export function getReducedMotionSafe(
  normalTransition: typeof transitions.normal,
  prefersReducedMotion: boolean
): typeof transitions.normal | typeof transitions.instant {
  return prefersReducedMotion ? transitions.instant : normalTransition;
}

// =============================================================================
// DOCUMENTATION
// =============================================================================

/**
 * Animation Timing Guidelines
 * ===========================
 *
 * DURATION SELECTION:
 *
 * | Element Type          | Recommended Duration | Notes                    |
 * |-----------------------|---------------------|--------------------------|
 * | Button press          | fast (150ms)        | Or use springs.button    |
 * | Toggle switch         | fast (150ms)        | Or use springs.snappy    |
 * | Dropdown menu         | normal (300ms)      | Or use springs.tooltip   |
 * | Modal open            | slow (500ms)        | Or use springs.modal     |
 * | Page transition       | slow-dramatic       | Or use springs.content   |
 * | Loading pulse         | processing (1.5s)   | Infinite loop            |
 * | Ambient breathing     | ambient (3s)        | Infinite loop            |
 *
 * WHEN TO USE DURATIONS vs SPRINGS:
 *
 * Use SPRINGS (from springs.ts) for:
 * - Interactive elements (buttons, toggles, drag)
 * - Any element that can be interrupted
 * - Elements where "weight" matters
 *
 * Use DURATIONS (from this file) for:
 * - CSS transitions (non-Framer Motion)
 * - Infinite looping animations
 * - Coordinated sequences with precise timing
 * - Non-interactive ambient effects
 *
 * LINEAR EASING:
 * Only use linear easing for:
 * - Continuous rotation (spinners)
 * - Progress bars
 * - Infinite looping ambient effects
 *
 * For all other cases, use smoothOut or spring physics.
 */
