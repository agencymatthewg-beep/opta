/**
 * Animation Library - Barrel Exports
 *
 * Premium physics-based animation system for Opta.
 * Provides spring presets, stagger utilities, haptic integration,
 * and shared element transitions.
 *
 * @example
 * ```tsx
 * import {
 *   springs,
 *   getSpring,
 *   staggerConfig,
 *   createContainerVariants,
 *   itemVariants,
 *   useHapticOnSettle,
 * } from '@/lib/animation';
 *
 * // Use spring preset
 * <motion.div transition={springs.snappy}>
 *
 * // Create staggered list
 * <motion.ul variants={createContainerVariants('fast')}>
 *   {items.map(item => (
 *     <motion.li variants={itemVariants}>{item.name}</motion.li>
 *   ))}
 * </motion.ul>
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

// =============================================================================
// SPRINGS
// =============================================================================

export {
  springs,
  getSpring,
  instantTransition,
  getSpringOrInstant,
  createCustomSpring,
  scaleSpring,
  type SpringPreset,
} from './springs';

// =============================================================================
// STAGGER
// =============================================================================

export {
  // Configurations
  staggerConfig,
  type StaggerPreset,

  // Item variants
  itemVariants,
  fadeItemVariants,
  slideItemVariants,
  popItemVariants,
  ignitionItemVariants,
  reducedMotionItemVariants,

  // Creators
  createContainerVariants,
  createItemVariants,
  createCustomStagger,

  // Utilities
  getStaggerDelay,
  calculateStaggerDuration,
  getStaggerVariants,
} from './stagger';

// =============================================================================
// TRANSITIONS (Shared Elements)
// =============================================================================

export {
  // Registry functions
  registerSharedElement,
  getSharedElementRect,
  clearSharedElement,
  clearAllSharedElements,
  hasSharedElement,

  // Transform calculations
  calculateTransform,
  calculateInverseTransform,

  // Crossfade
  createCrossfadeVariants,
  defaultCrossfade,

  // Layout helpers
  getLayoutTransition,
  createSharedElementId,

  // Types
  type SharedElementRect,
  type CrossfadeConfig,
} from './transitions';

// =============================================================================
// HAPTICS
// =============================================================================

export {
  // Hooks
  useHapticOnSettle,
  useHapticSpring,
  useHapticOnComplete,

  // Utilities
  triggerHapticDelayed,
  triggerHapticSequence,
  estimateSpringSettleTime,
  createHapticTiming,

  // Types
  type HapticOnSettleOptions,
  type HapticSpringOptions,
} from './haptics';

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

export {
  // Duration constants
  DURATION,
  DURATION_SECONDS,

  // Delay constants
  DELAY,
  DELAY_SECONDS,

  // Easing curves
  EASING,
  FRAMER_EASING,

  // Composite transitions
  transitions,

  // CSS helpers
  cssTransition,

  // Utilities
  getDuration,
  getDelay,
  getStaggerDelay as getTimingStaggerDelay,
  getReducedMotionSafe,

  // Types
  type DurationTier,
} from './timing';

// =============================================================================
// DOCUMENTATION
// =============================================================================

/**
 * Animation System Overview
 * =========================
 *
 * This animation system is built on three core principles from the Gemini research:
 *
 * 1. **Physics-Based Motion**
 *    - Springs instead of duration-based animations
 *    - Elements have "weight" through mass, stiffness, damping
 *    - Interruptible animations that retarget smoothly
 *
 * 2. **Visual Continuity**
 *    - Shared element transitions prevent jarring cuts
 *    - Staggered entry creates hierarchy and flow
 *    - Blur-back provides depth perception
 *
 * 3. **Multi-Sensory Feedback**
 *    - Haptics synchronized with spring settle
 *    - Chromatic aberration for loading states
 *    - Micro-interactions reward engagement
 *
 *
 * Quick Reference
 * ---------------
 *
 * | Need                    | Use                              |
 * |------------------------|----------------------------------|
 * | Button press           | springs.button or springs.snappy |
 * | Modal open             | springs.modal or springs.bouncy  |
 * | Content transition     | springs.content or springs.smooth|
 * | Hover effect           | springs.gentle                   |
 * | Drag overscroll        | springs.rubberBand               |
 * | List cascade           | staggerConfig.normal + itemVariants |
 * | Shared element         | useSharedElement hook            |
 * | Loading state          | useChromaticLoading hook         |
 * | Haptic on settle       | useHapticOnSettle hook           |
 *
 *
 * Reduced Motion Support
 * ----------------------
 *
 * All utilities support prefers-reduced-motion:
 * - getSpringOrInstant() returns instant transition when reduced motion preferred
 * - getStaggerVariants() returns simplified variants
 * - Hooks accept `enabled` option to disable effects
 *
 *
 * Performance Notes
 * -----------------
 *
 * - Springs are GPU-accelerated via transform
 * - Use layout animations sparingly (expensive)
 * - Chromatic effect uses WebGL with CSS fallback
 * - Target 120fps during all animations
 */
