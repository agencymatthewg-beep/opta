/**
 * Shared Element Transition Utilities
 *
 * Provides infrastructure for smooth element morphing between states.
 * Enables visual continuity when elements move between different
 * positions or views.
 *
 * Per Gemini research:
 * - "Visual continuity - Shared element transitions prevent jarring cuts"
 * - "Elements morph smoothly between positions"
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

// =============================================================================
// SHARED ELEMENT REGISTRY
// =============================================================================

/**
 * Stored rect information for a shared element
 */
export interface SharedElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Global registry for shared element positions
 * Elements register their positions when they mount/unmount
 * so subsequent mounts can animate from the previous position
 */
const sharedElementRegistry = new Map<string, SharedElementRect>();

/**
 * Register an element's current position
 *
 * @param id - Unique identifier for the shared element
 * @param rect - The element's bounding rect
 */
export function registerSharedElement(id: string, rect: DOMRect): void {
  sharedElementRegistry.set(id, {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    timestamp: Date.now(),
  });
}

/**
 * Get a previously registered element's position
 *
 * @param id - Unique identifier for the shared element
 * @returns The stored rect or null if not found
 */
export function getSharedElementRect(id: string): SharedElementRect | null {
  return sharedElementRegistry.get(id) ?? null;
}

/**
 * Clear a shared element from the registry
 *
 * @param id - Unique identifier for the shared element
 */
export function clearSharedElement(id: string): void {
  sharedElementRegistry.delete(id);
}

/**
 * Clear all shared elements from the registry
 * Useful when navigating to a completely new section
 */
export function clearAllSharedElements(): void {
  sharedElementRegistry.clear();
}

/**
 * Check if a shared element exists in the registry
 *
 * @param id - Unique identifier
 * @returns Whether the element is registered
 */
export function hasSharedElement(id: string): boolean {
  return sharedElementRegistry.has(id);
}

// =============================================================================
// TRANSITION CALCULATION
// =============================================================================

/**
 * Calculate the transform needed to animate from one rect to another
 *
 * @param from - Source rect
 * @param to - Target rect
 * @returns Transform values for animation
 */
export function calculateTransform(
  from: SharedElementRect,
  to: DOMRect
): { x: number; y: number; scaleX: number; scaleY: number } {
  return {
    x: from.x - to.x,
    y: from.y - to.y,
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
  };
}

/**
 * Calculate the inverse transform (for animating "to" the target position)
 *
 * @param from - Source rect
 * @param to - Target rect
 * @returns Inverse transform values
 */
export function calculateInverseTransform(
  from: SharedElementRect,
  to: DOMRect
): { x: number; y: number; scaleX: number; scaleY: number } {
  const transform = calculateTransform(from, to);
  return {
    x: -transform.x,
    y: -transform.y,
    scaleX: 1 / transform.scaleX,
    scaleY: 1 / transform.scaleY,
  };
}

// =============================================================================
// CROSSFADE UTILITIES
// =============================================================================

/**
 * Crossfade configuration for elements that don't share geometry
 */
export interface CrossfadeConfig {
  /** Duration of the crossfade in seconds */
  duration?: number;
  /** Easing function */
  ease?: number[];
  /** Delay before starting */
  delay?: number;
}

/**
 * Default crossfade configuration
 */
export const defaultCrossfade: Required<CrossfadeConfig> = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
  delay: 0,
};

/**
 * Create crossfade variants for AnimatePresence mode="popLayout"
 *
 * @param config - Crossfade configuration
 * @returns Framer Motion variants for crossfade
 */
export function createCrossfadeVariants(config: CrossfadeConfig = {}) {
  const { duration, ease, delay } = { ...defaultCrossfade, ...config };

  return {
    initial: {
      opacity: 0,
      filter: 'blur(4px)',
    },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration, ease, delay },
    },
    exit: {
      opacity: 0,
      filter: 'blur(4px)',
      transition: { duration: duration * 0.6, ease },
    },
  };
}

// =============================================================================
// LAYOUT ANIMATION HELPERS
// =============================================================================

/**
 * Get layout transition config for shared elements
 * Uses spring physics for natural movement
 *
 * @param preset - Speed preset
 * @returns Transition configuration for layout animations
 */
export function getLayoutTransition(
  preset: 'fast' | 'normal' | 'slow' = 'normal'
) {
  const configs = {
    fast: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 },
    normal: { type: 'spring', stiffness: 350, damping: 30, mass: 1 },
    slow: { type: 'spring', stiffness: 200, damping: 25, mass: 1.2 },
  } as const;

  return {
    layout: configs[preset],
  };
}

/**
 * Create a unique shared element ID
 *
 * @param namespace - Namespace for the element (e.g., 'card', 'image')
 * @param id - Unique identifier within the namespace
 * @returns Formatted shared element ID
 */
export function createSharedElementId(namespace: string, id: string | number): string {
  return `shared-${namespace}-${id}`;
}
