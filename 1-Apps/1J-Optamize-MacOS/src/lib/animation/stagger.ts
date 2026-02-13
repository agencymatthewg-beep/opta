/**
 * Staggered Entry Animation Utilities
 *
 * Provides cascading animation effects for lists and grids.
 * Items enter with a slight delay between each, creating
 * a premium "reveal" effect.
 *
 * Per Gemini research:
 * - "Staggered Entry: Items cascade in with 10-20ms delay"
 * - "Creates depth and visual hierarchy"
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import type { Variants } from 'framer-motion';
import { springs, type SpringPreset } from './springs';

// =============================================================================
// STAGGER CONFIGURATIONS
// =============================================================================

/**
 * Stagger timing configurations
 *
 * - **fast**: Quick cascade, good for small lists (5-10 items)
 * - **normal**: Standard cascade, good for medium lists (10-20 items)
 * - **slow**: Dramatic cascade, good for hero sections
 * - **instant**: No stagger, items appear together (for reduced motion)
 */
export const staggerConfig = {
  /** 20ms between items, no initial delay */
  fast: { staggerChildren: 0.02, delayChildren: 0 },
  /** 40ms between items, 50ms initial delay */
  normal: { staggerChildren: 0.04, delayChildren: 0.05 },
  /** 80ms between items, 100ms initial delay */
  slow: { staggerChildren: 0.08, delayChildren: 0.1 },
  /** 60ms between items, 150ms initial delay - for hero reveals */
  dramatic: { staggerChildren: 0.06, delayChildren: 0.15 },
  /** No stagger for reduced motion */
  instant: { staggerChildren: 0, delayChildren: 0 },
} as const;

export type StaggerPreset = keyof typeof staggerConfig;

// =============================================================================
// ITEM VARIANTS
// =============================================================================

/**
 * Standard item variants for staggered lists
 * Elements fade in and slide up slightly
 */
export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
  },
};

/**
 * Fade-only item variants (no position change)
 * Good for grid layouts where position change might look odd
 */
export const fadeItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
  },
};

/**
 * Slide-in item variants (horizontal)
 * Good for sidebar menus or horizontal lists
 */
export const slideItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -16,
  },
  visible: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: 8,
  },
};

/**
 * Pop-in item variants (scale emphasis)
 * Good for cards and tiles
 */
export const popItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.85,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
  },
};

/**
 * Ignition item variants (Obsidian style)
 * Elements emerge from darkness with brightness change
 */
export const ignitionItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    filter: 'brightness(0.5) blur(4px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'brightness(1) blur(0px)',
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    filter: 'brightness(0.8) blur(2px)',
  },
};

// =============================================================================
// CONTAINER VARIANT CREATORS
// =============================================================================

/**
 * Create container variants with custom stagger config
 *
 * @param stagger - Stagger preset name or custom config
 * @returns Framer Motion variants for the container
 *
 * @example
 * ```tsx
 * <motion.ul
 *   variants={createContainerVariants('fast')}
 *   initial="hidden"
 *   animate="visible"
 * >
 *   {items.map(item => (
 *     <motion.li key={item.id} variants={itemVariants}>
 *       {item.name}
 *     </motion.li>
 *   ))}
 * </motion.ul>
 * ```
 */
export function createContainerVariants(
  stagger: StaggerPreset | { staggerChildren: number; delayChildren: number }
): Variants {
  const config = typeof stagger === 'string' ? staggerConfig[stagger] : stagger;

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: config,
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: config.staggerChildren * 0.5,
        staggerDirection: -1, // Reverse order on exit
      },
    },
  };
}

/**
 * Create item variants with custom spring config
 *
 * @param springPreset - Spring preset for the item animation
 * @param variant - Base variant style
 * @returns Framer Motion variants for items
 */
export function createItemVariants(
  springPreset: SpringPreset = 'smooth',
  variant: 'standard' | 'fade' | 'slide' | 'pop' | 'ignition' = 'standard'
): Variants {
  const baseVariants = {
    standard: itemVariants,
    fade: fadeItemVariants,
    slide: slideItemVariants,
    pop: popItemVariants,
    ignition: ignitionItemVariants,
  }[variant];

  const spring = springs[springPreset];

  return {
    hidden: baseVariants.hidden,
    visible: {
      ...baseVariants.visible,
      transition: spring,
    },
    exit: {
      ...baseVariants.exit,
      transition: { duration: 0.15 },
    },
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get stagger delay for a specific index
 * Useful when you need to calculate delay manually
 *
 * @param index - Item index
 * @param preset - Stagger preset
 * @returns Delay in seconds
 */
export function getStaggerDelay(index: number, preset: StaggerPreset = 'normal'): number {
  const config = staggerConfig[preset];
  return config.delayChildren + index * config.staggerChildren;
}

/**
 * Create a custom stagger transition
 *
 * @param staggerMs - Delay between items in milliseconds
 * @param initialDelayMs - Initial delay in milliseconds
 * @returns Stagger configuration object
 */
export function createCustomStagger(staggerMs: number, initialDelayMs = 0) {
  return {
    staggerChildren: staggerMs / 1000,
    delayChildren: initialDelayMs / 1000,
  };
}

/**
 * Calculate total animation duration for a staggered list
 * Useful for coordinating animations or triggering actions after complete
 *
 * @param itemCount - Number of items
 * @param preset - Stagger preset
 * @param itemDurationMs - Duration of each item's animation (default 300ms)
 * @returns Total duration in milliseconds
 */
export function calculateStaggerDuration(
  itemCount: number,
  preset: StaggerPreset = 'normal',
  itemDurationMs = 300
): number {
  const config = staggerConfig[preset];
  const staggerTotal = (itemCount - 1) * config.staggerChildren * 1000;
  const initialDelay = config.delayChildren * 1000;
  return initialDelay + staggerTotal + itemDurationMs;
}

// =============================================================================
// REDUCED MOTION VARIANTS
// =============================================================================

/**
 * Reduced motion item variants
 * Simple fade with no movement
 */
export const reducedMotionItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

/**
 * Get appropriate variants based on reduced motion preference
 */
export function getStaggerVariants(
  prefersReducedMotion: boolean,
  variant: 'standard' | 'fade' | 'slide' | 'pop' | 'ignition' = 'standard'
): { container: Variants; item: Variants } {
  if (prefersReducedMotion) {
    return {
      container: createContainerVariants('instant'),
      item: reducedMotionItemVariants,
    };
  }

  return {
    container: createContainerVariants('normal'),
    item: createItemVariants('smooth', variant),
  };
}
