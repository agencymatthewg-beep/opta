/**
 * Physics-Based Spring Presets - Premium Animation System
 *
 * Spring presets based on context and perceived "weight".
 * Linear animations feel robotic; springs feel premium.
 *
 * Per Gemini research:
 * - "Configure mass, stiffness, damping instead of duration-based animations"
 * - "Elements have 'weight' - flick and bounce with momentum"
 * - "Subtle overshoot = hallmark of premium iOS interfaces"
 * - "Interruptible springs: Retarget from current velocity on interrupt"
 *
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

import type { SpringOptions, Transition } from 'framer-motion';

// =============================================================================
// CORE SPRING PRESETS
// =============================================================================

/**
 * Core spring presets for different interaction contexts
 *
 * - **snappy**: Small elements, immediate feedback (buttons, toggles)
 * - **bouncy**: Big reveals, celebration moments (modals, score cards)
 * - **smooth**: Content transitions (page changes, list updates)
 * - **gentle**: Subtle effects (hover states, micro-interactions)
 *
 * Phase 35 additions:
 * - **default**: Standard spring { stiffness: 200, damping: 25 }
 * - **quick**: Fast response { stiffness: 400, damping: 30 }
 * - **slow**: Deliberate motion { stiffness: 100, damping: 20 }
 * - **page**: Page transitions { stiffness: 200, damping: 25 }
 * - **pageExit**: Quick exit { stiffness: 300, damping: 30 }
 * - **cardLift**: Hover lift { stiffness: 200, damping: 25 }
 * - **ripple**: Click ripple { stiffness: 200, damping: 25 }
 */
export const springs = {
  // Core presets - based on perceived weight and interaction context
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 1 } as const,
  bouncy: { type: 'spring', stiffness: 300, damping: 20, mass: 1 } as const,
  smooth: { type: 'spring', stiffness: 200, damping: 25, mass: 1 } as const,
  gentle: { type: 'spring', stiffness: 150, damping: 20, mass: 0.8 } as const,

  // Phase 35: Standard spring presets
  default: { type: 'spring', stiffness: 200, damping: 25, mass: 1 } as const,
  quick: { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const,
  slow: { type: 'spring', stiffness: 100, damping: 20, mass: 1 } as const,

  // Phase 35: Page transition springs
  page: { type: 'spring', stiffness: 200, damping: 25, mass: 1 } as const,
  pageExit: { type: 'spring', stiffness: 300, damping: 30, mass: 1 } as const,

  // Phase 35: Micro-interaction springs
  cardLift: { type: 'spring', stiffness: 200, damping: 25, mass: 0.9 } as const,
  ripple: { type: 'spring', stiffness: 200, damping: 25, mass: 1 } as const,
  hover: { type: 'spring', stiffness: 250, damping: 25, mass: 0.9 } as const,

  // Context-specific presets - tuned for specific UI elements
  button: { type: 'spring', stiffness: 600, damping: 35, mass: 0.8 } as const,
  modal: { type: 'spring', stiffness: 400, damping: 30, mass: 1.2 } as const,
  content: { type: 'spring', stiffness: 250, damping: 30, mass: 1 } as const,
  sidebar: { type: 'spring', stiffness: 350, damping: 35, mass: 1 } as const,
  tooltip: { type: 'spring', stiffness: 500, damping: 25, mass: 0.5 } as const,
  drawer: { type: 'spring', stiffness: 300, damping: 30, mass: 1.1 } as const,
  card: { type: 'spring', stiffness: 350, damping: 28, mass: 0.9 } as const,
  list: { type: 'spring', stiffness: 280, damping: 26, mass: 1 } as const,

  // Rubber band effect (overscroll, drag limits)
  // High stiffness + high damping = quick snap back without oscillation
  rubberBand: { type: 'spring', stiffness: 800, damping: 40, mass: 0.5 } as const,

  // Settle spring (for haptic sync - lower stiffness means more oscillation)
  settle: { type: 'spring', stiffness: 200, damping: 15, mass: 1 } as const,
} as const;

/**
 * Type for spring preset names
 */
export type SpringPreset = keyof typeof springs;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get spring configuration by preset name
 *
 * @param preset - The preset name
 * @returns Spring configuration for Framer Motion
 *
 * @example
 * ```tsx
 * <motion.div
 *   animate={{ scale: 1 }}
 *   transition={getSpring('snappy')}
 * />
 * ```
 */
export function getSpring(preset: SpringPreset): SpringOptions {
  return springs[preset] as SpringOptions;
}

/**
 * Instant transition for reduced motion or immediate effects
 * Duration of 0 means no animation
 */
export const instantTransition = { type: 'tween', duration: 0 } as const;

/**
 * Get spring or instant transition based on reduced motion preference
 *
 * @param preset - The spring preset to use
 * @param prefersReducedMotion - Whether user prefers reduced motion
 * @returns Appropriate transition configuration
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * <motion.div transition={getSpringOrInstant('snappy', prefersReducedMotion)} />
 * ```
 */
export function getSpringOrInstant(
  preset: SpringPreset,
  prefersReducedMotion: boolean
): Transition {
  return prefersReducedMotion ? instantTransition : springs[preset];
}

/**
 * Create a custom spring with modified parameters
 *
 * @param preset - Base preset to modify
 * @param overrides - Parameters to override
 * @returns Modified spring configuration
 *
 * @example
 * ```tsx
 * const heavyBouncy = createCustomSpring('bouncy', { mass: 1.5 });
 * ```
 */
export function createCustomSpring(
  preset: SpringPreset,
  overrides: Partial<{ stiffness: number; damping: number; mass: number }>
): { type: 'spring'; stiffness: number; damping: number; mass: number } {
  const base = springs[preset];
  return {
    type: 'spring',
    stiffness: overrides.stiffness ?? base.stiffness,
    damping: overrides.damping ?? base.damping,
    mass: overrides.mass ?? base.mass,
  };
}

/**
 * Scale a spring's stiffness and damping proportionally
 * Useful for making springs feel heavier or lighter
 *
 * @param preset - Base preset
 * @param scale - Scale factor (0.5 = half as stiff, 2 = twice as stiff)
 * @returns Scaled spring configuration
 */
export function scaleSpring(
  preset: SpringPreset,
  scale: number
): { type: 'spring'; stiffness: number; damping: number; mass: number } {
  const base = springs[preset];
  return {
    type: 'spring',
    stiffness: base.stiffness * scale,
    damping: base.damping * Math.sqrt(scale), // Damping scales with sqrt for similar feel
    mass: base.mass,
  };
}

// =============================================================================
// SPRING DOCUMENTATION
// =============================================================================

/**
 * Spring Preset Selection Guide:
 *
 * | Context              | Recommended Preset | Why                           |
 * |---------------------|-------------------|-------------------------------|
 * | Button press        | button, snappy    | Immediate feedback            |
 * | Toggle switch       | snappy            | Quick, decisive response      |
 * | Modal open          | modal, bouncy     | Grand reveal with weight      |
 * | Modal close         | snappy            | Dismiss quickly               |
 * | Page transition     | content, smooth   | Smooth content flow           |
 * | Sidebar open/close  | sidebar           | Balanced slide                |
 * | Card hover lift     | gentle            | Subtle, not jarring           |
 * | Tooltip appear      | tooltip           | Quick, light element          |
 * | List item enter     | list              | Cascading content             |
 * | Drag overscroll     | rubberBand        | Elastic boundary              |
 * | Success celebration | bouncy            | Playful bounce                |
 * | Error shake         | snappy            | Quick attention grab          |
 *
 * Key Parameters:
 * - **stiffness**: How "tight" the spring is (higher = snappier)
 * - **damping**: How quickly oscillation stops (higher = less bounce)
 * - **mass**: How "heavy" the element feels (higher = more momentum)
 *
 * The critical damping ratio is: damping / (2 * sqrt(stiffness * mass))
 * - Ratio < 1: Underdamped (bouncy)
 * - Ratio = 1: Critically damped (no bounce, fastest settle)
 * - Ratio > 1: Overdamped (sluggish, no bounce)
 */
