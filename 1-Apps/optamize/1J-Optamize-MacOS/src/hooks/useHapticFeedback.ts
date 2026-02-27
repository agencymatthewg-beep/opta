/**
 * useHapticFeedback - Hook for haptic/vibration feedback on interactions
 *
 * Provides tactile feedback using the Web Vibration API where supported.
 * Falls back gracefully on unsupported platforms (desktop browsers).
 *
 * Haptic patterns are designed to be subtle and non-intrusive,
 * following the Opta design philosophy of premium, responsive feedback.
 */

import { useCallback, useMemo } from 'react';

/**
 * Predefined haptic patterns for different interaction types
 */
export const HapticPatterns = {
  /** Light tap - single short vibration for button clicks */
  tap: [10],
  /** Medium feedback - for successful actions */
  success: [10, 50, 10],
  /** Heavier feedback - for drag pickup */
  pickup: [15],
  /** Release feedback - for drop actions */
  drop: [8, 30, 15],
  /** Error feedback - longer pattern for failed actions */
  error: [20, 50, 20, 50, 20],
  /** Selection feedback - subtle confirmation */
  select: [5],
  /** Destructive action - warning pattern */
  destructive: [30, 80, 30],
} as const;

export type HapticPatternName = keyof typeof HapticPatterns;

export interface UseHapticFeedbackOptions {
  /** Whether haptic feedback is enabled (respects user preferences) */
  enabled?: boolean;
  /** Intensity multiplier (0-1, default 1) */
  intensity?: number;
}

export interface UseHapticFeedbackReturn {
  /** Trigger a named haptic pattern */
  trigger: (pattern: HapticPatternName) => void;
  /** Trigger a custom vibration pattern */
  vibrate: (pattern: number | number[]) => void;
  /** Whether haptic feedback is supported on this device */
  isSupported: boolean;
  /** Check if user prefers reduced motion */
  prefersReducedMotion: boolean;
}

/**
 * Hook for triggering haptic feedback
 *
 * @example
 * ```tsx
 * const { trigger, isSupported } = useHapticFeedback();
 *
 * const handleDragStart = () => {
 *   trigger('pickup');
 * };
 *
 * const handleDrop = (success: boolean) => {
 *   trigger(success ? 'success' : 'error');
 * };
 * ```
 */
export function useHapticFeedback(
  options: UseHapticFeedbackOptions = {}
): UseHapticFeedbackReturn {
  const { enabled = true, intensity = 1 } = options;

  // Check for Vibration API support
  const isSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }, []);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /**
   * Apply intensity multiplier to a vibration pattern
   */
  const applyIntensity = useCallback(
    (pattern: number[]): number[] => {
      if (intensity === 1) return pattern;
      // Scale vibration durations by intensity
      return pattern.map((duration) => Math.round(duration * intensity));
    },
    [intensity]
  );

  /**
   * Trigger vibration with a raw pattern
   */
  const vibrate = useCallback(
    (pattern: number | number[]) => {
      // Skip if disabled, not supported, or user prefers reduced motion
      if (!enabled || !isSupported || prefersReducedMotion) {
        return;
      }

      try {
        const patternArray = Array.isArray(pattern) ? pattern : [pattern];
        const scaledPattern = applyIntensity(patternArray);
        navigator.vibrate(scaledPattern);
      } catch {
        // Silently fail - haptic feedback is non-critical
        console.debug('Haptic feedback failed');
      }
    },
    [enabled, isSupported, prefersReducedMotion, applyIntensity]
  );

  /**
   * Trigger a named haptic pattern
   */
  const trigger = useCallback(
    (patternName: HapticPatternName) => {
      const pattern = HapticPatterns[patternName];
      vibrate([...pattern]); // Copy array to avoid mutation
    },
    [vibrate]
  );

  return {
    trigger,
    vibrate,
    isSupported,
    prefersReducedMotion,
  };
}

export default useHapticFeedback;
