/**
 * useReducedMotion - Comprehensive Reduced Motion Accessibility Hook
 *
 * Provides complete support for users who prefer reduced motion, including:
 * - System preference detection (prefers-reduced-motion)
 * - Manual override capability
 * - Transition presets for reduced motion
 * - Integration with Framer Motion
 *
 * When reduced motion is enabled:
 * - All particle systems are disabled
 * - Simple fade transitions replace complex animations
 * - Ring remains static (no spin/pulse)
 * - No parallax effects
 * - Instant state changes where appropriate
 *
 * @see DESIGN_SYSTEM.md - Animation Presets (Reduced Motion Support)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Transition } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

export interface ReducedMotionSettings {
  /** Whether reduced motion is currently active */
  isEnabled: boolean;
  /** Whether this is from system preference (true) or manual override (false) */
  isSystemPreference: boolean;
  /** User has explicitly set a preference (overrides system) */
  hasUserOverride: boolean;
}

export interface ReducedMotionTransitions {
  /** Instant transition with no animation */
  instant: Transition;
  /** Simple fade transition */
  fade: Transition;
  /** Quick fade for UI elements */
  quickFade: Transition;
  /** Standard spring transition (or instant if reduced) */
  spring: Transition;
  /** Gentle spring transition (or fade if reduced) */
  springGentle: Transition;
  /** Page transition (or fade if reduced) */
  page: Transition;
}

export interface UseReducedMotionReturn {
  /** Whether reduced motion is enabled (system or manual) */
  prefersReducedMotion: boolean;
  /** Detailed settings about the current state */
  settings: ReducedMotionSettings;
  /** Manually set reduced motion preference */
  setReducedMotion: (enabled: boolean) => void;
  /** Clear manual override and use system preference */
  clearOverride: () => void;
  /** Get appropriate transition based on reduced motion state */
  getTransition: (name: keyof ReducedMotionTransitions) => Transition;
  /** All transitions adjusted for reduced motion */
  transitions: ReducedMotionTransitions;
  /** Framer Motion variants that respect reduced motion */
  variants: {
    fadeIn: object;
    fadeOut: object;
    scaleIn: object;
    slideUp: object;
    staggerChildren: object;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'opta_reduced_motion_preference';

/**
 * Standard transitions for normal motion
 */
const STANDARD_TRANSITIONS: ReducedMotionTransitions = {
  instant: { duration: 0 },
  fade: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  quickFade: { duration: 0.15, ease: 'easeOut' },
  spring: { type: 'spring', stiffness: 400, damping: 30 },
  springGentle: { type: 'spring', stiffness: 200, damping: 25 },
  page: { type: 'spring', stiffness: 100, damping: 20 },
};

/**
 * Reduced motion transitions (instant or simple fades)
 */
const REDUCED_TRANSITIONS: ReducedMotionTransitions = {
  instant: { duration: 0 },
  fade: { duration: 0.1, ease: 'linear' },
  quickFade: { duration: 0 },
  spring: { duration: 0 }, // Instant instead of spring
  springGentle: { duration: 0.1, ease: 'linear' },
  page: { duration: 0.15, ease: 'linear' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check system preference for reduced motion
 */
function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get stored user preference
 */
function getStoredPreference(): boolean | null {
  if (typeof localStorage === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return null;

  try {
    return JSON.parse(stored) as boolean;
  } catch {
    return null;
  }
}

/**
 * Store user preference
 */
function storePreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
}

/**
 * Clear stored preference
 */
function clearStoredPreference(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Full reduced motion hook with comprehensive utilities.
 * Respects the `prefers-reduced-motion: reduce` media query and
 * allows manual user override.
 *
 * @returns Comprehensive reduced motion utilities
 *
 * @example
 * ```tsx
 * const { prefersReducedMotion, transitions, getTransition } = useReducedMotionFull();
 *
 * // Use with Framer Motion
 * <motion.div
 *   animate={{ opacity: 1, y: 0 }}
 *   transition={getTransition('spring')}
 * >
 *
 * // Or use the convenience transitions object
 * <motion.div transition={transitions.springGentle}>
 *
 * // Conditionally disable complex effects
 * {!prefersReducedMotion && <ParticleField />}
 * ```
 */
export function useReducedMotionFull(): UseReducedMotionReturn {
  // Track system preference
  const [systemPreference, setSystemPreference] = useState(getSystemPreference);

  // Track user override
  const [userOverride, setUserOverride] = useState<boolean | null>(() => getStoredPreference());

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPreference(event.matches);
    };

    // Set initial value
    setSystemPreference(mediaQuery.matches);

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Compute effective preference
  const prefersReducedMotion = useMemo(() => {
    // User override takes precedence
    if (userOverride !== null) {
      return userOverride;
    }
    // Otherwise use system preference
    return systemPreference;
  }, [userOverride, systemPreference]);

  // Build settings object
  const settings = useMemo<ReducedMotionSettings>(() => ({
    isEnabled: prefersReducedMotion,
    isSystemPreference: userOverride === null && systemPreference,
    hasUserOverride: userOverride !== null,
  }), [prefersReducedMotion, systemPreference, userOverride]);

  // Manual setter
  const setReducedMotion = useCallback((enabled: boolean) => {
    setUserOverride(enabled);
    storePreference(enabled);
  }, []);

  // Clear override
  const clearOverride = useCallback(() => {
    setUserOverride(null);
    clearStoredPreference();
  }, []);

  // Get transition for a given name
  const getTransition = useCallback((name: keyof ReducedMotionTransitions): Transition => {
    return prefersReducedMotion ? REDUCED_TRANSITIONS[name] : STANDARD_TRANSITIONS[name];
  }, [prefersReducedMotion]);

  // Memoized transitions object
  const transitions = useMemo<ReducedMotionTransitions>(() => {
    return prefersReducedMotion ? REDUCED_TRANSITIONS : STANDARD_TRANSITIONS;
  }, [prefersReducedMotion]);

  // Framer Motion variants that respect reduced motion
  const variants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        fadeIn: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
        fadeOut: {
          initial: { opacity: 1 },
          animate: { opacity: 0 },
          exit: { opacity: 0 },
        },
        scaleIn: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
        slideUp: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
        staggerChildren: {
          animate: {
            transition: { staggerChildren: 0 }, // No stagger
          },
        },
      };
    }

    return {
      fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      },
      fadeOut: {
        initial: { opacity: 1 },
        animate: { opacity: 0 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      },
      scaleIn: {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 },
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      },
      slideUp: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      },
      staggerChildren: {
        animate: {
          transition: { staggerChildren: 0.05 },
        },
      },
    };
  }, [prefersReducedMotion]);

  return {
    prefersReducedMotion,
    settings,
    setReducedMotion,
    clearOverride,
    getTransition,
    transitions,
    variants,
  };
}

// =============================================================================
// SIMPLE BOOLEAN HOOK (Primary Export - Backwards Compatible)
// =============================================================================

/**
 * Hook to detect if the user prefers reduced motion.
 * Respects the `prefers-reduced-motion: reduce` media query.
 * Returns true if reduced motion is preferred, false otherwise.
 *
 * This is the default export for backward compatibility with existing code.
 * For full control over reduced motion settings, use `useReducedMotionFull`.
 *
 * @returns true if reduced motion is preferred, false otherwise
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 };
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference (including stored user preference)
    const stored = getStoredPreference();
    const system = getSystemPreference();
    setPrefersReducedMotion(stored !== null ? stored : system);

    // Listen for system changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      // Only update if no user override
      const currentStored = getStoredPreference();
      if (currentStored === null) {
        setPrefersReducedMotion(event.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if reduced motion is preferred (one-time check, non-reactive)
 * Useful for static contexts or initial render decisions.
 */
export function checkReducedMotion(): boolean {
  const stored = getStoredPreference();
  if (stored !== null) return stored;
  return getSystemPreference();
}

/**
 * Get instant transition (useful for conditional rendering)
 */
export function getInstantTransition(): Transition {
  return { duration: 0 };
}

/**
 * Get appropriate transition based on reduced motion state
 */
export function getMotionSafeTransition(
  normalTransition: Transition,
  reducedMotion: boolean
): Transition {
  if (reducedMotion) {
    return { duration: 0 };
  }
  return normalTransition;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default useReducedMotion;
