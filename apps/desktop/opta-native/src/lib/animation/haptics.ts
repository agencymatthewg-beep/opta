/**
 * Haptic Sync Utilities - Animation-Synchronized Haptic Feedback
 *
 * Utilities for firing haptic feedback synchronized with spring animations.
 * Detects when spring velocity approaches zero (settled) to trigger haptics.
 *
 * Per Gemini research:
 * - "Haptics sync with spring animation (thud when velocity = 0)"
 * - "Perfect timing creates premium feel"
 *
 * Note: Full haptic implementation is in src/lib/haptics.ts and hooks/useHapticFeedback.ts
 * This file provides animation-specific integration.
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSpring, type MotionValue, type SpringOptions } from 'framer-motion';
import { haptic, type HapticIntent } from '@/lib/haptics';
import { springs, type SpringPreset } from './springs';

// =============================================================================
// TYPES
// =============================================================================

export interface HapticOnSettleOptions {
  /** Velocity threshold to consider "settled" (default: 0.5) */
  threshold?: number;
  /** Whether haptic is enabled */
  enabled?: boolean;
  /** Debounce time in ms to prevent multiple triggers */
  debounceMs?: number;
}

export interface HapticSpringOptions extends SpringOptions {
  /** Haptic type to trigger on settle */
  hapticType?: HapticIntent;
  /** Haptic options */
  hapticOptions?: HapticOnSettleOptions;
}

// =============================================================================
// HAPTIC ON SETTLE HOOK
// =============================================================================

/**
 * Fire haptic when spring velocity reaches zero (settled)
 *
 * Listens to a motion value's velocity and triggers haptic feedback
 * when the animation settles.
 *
 * @param motionValue - Framer Motion value to monitor
 * @param hapticType - Type of haptic to trigger
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function DraggableItem() {
 *   const x = useSpring(0);
 *
 *   // Trigger haptic when drag settles
 *   useHapticOnSettle(x, 'selection');
 *
 *   return <motion.div style={{ x }} drag="x" />;
 * }
 * ```
 */
export function useHapticOnSettle(
  motionValue: MotionValue<number>,
  hapticType: HapticIntent = 'selection',
  options: HapticOnSettleOptions = {}
): void {
  const { threshold = 0.5, enabled = true, debounceMs = 50 } = options;

  const lastTriggerRef = useRef(0);
  const wasMovingRef = useRef(false);
  const lastValueRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to motion value changes
    const unsubscribe = motionValue.on('change', (value) => {
      // Calculate velocity from change in value
      if (lastValueRef.current !== null) {
        const delta = Math.abs(value - lastValueRef.current);

        // Track if we were moving (velocity above threshold)
        if (delta > threshold * 2) {
          wasMovingRef.current = true;
        }

        // Check if we just settled (was moving, now stopped)
        if (wasMovingRef.current && delta < threshold) {
          const now = Date.now();

          // Debounce to prevent multiple triggers
          if (now - lastTriggerRef.current > debounceMs) {
            lastTriggerRef.current = now;
            wasMovingRef.current = false;

            // Fire haptic
            haptic(hapticType);
          }
        }
      }

      lastValueRef.current = value;
    });

    return () => {
      unsubscribe();
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [motionValue, hapticType, threshold, enabled, debounceMs]);
}

// =============================================================================
// HAPTIC SPRING HOOK
// =============================================================================

/**
 * Create a spring motion value that triggers haptic on settle
 *
 * Combines useSpring with automatic haptic feedback.
 *
 * @param initialValue - Initial value
 * @param springConfig - Spring configuration (preset name or config object)
 * @param hapticType - Haptic type to trigger
 * @param hapticOptions - Haptic options
 * @returns Spring motion value
 *
 * @example
 * ```tsx
 * function Toggle({ active }: { active: boolean }) {
 *   const x = useHapticSpring(active ? 20 : 0, 'snappy', 'selection');
 *
 *   return <motion.div style={{ x }}>Toggle</motion.div>;
 * }
 * ```
 */
export function useHapticSpring(
  initialValue: number,
  springConfig: SpringPreset | SpringOptions = 'smooth',
  hapticType: HapticIntent = 'selection',
  hapticOptions?: HapticOnSettleOptions
): MotionValue<number> {
  // Get spring config
  const config = typeof springConfig === 'string' ? springs[springConfig] : springConfig;

  // Create spring
  const spring = useSpring(initialValue, config);

  // Attach haptic listener
  useHapticOnSettle(spring, hapticType, hapticOptions);

  return spring;
}

// =============================================================================
// HAPTIC ANIMATION CALLBACK
// =============================================================================

/**
 * Create a callback that triggers haptic at the end of an animation
 *
 * Use this with Framer Motion's onAnimationComplete prop.
 *
 * @param hapticType - Haptic type to trigger
 * @param enabled - Whether haptic is enabled
 * @returns Callback function
 *
 * @example
 * ```tsx
 * function Modal({ isOpen }: { isOpen: boolean }) {
 *   const hapticComplete = useHapticOnComplete('success');
 *
 *   return (
 *     <motion.div
 *       animate={{ opacity: isOpen ? 1 : 0 }}
 *       onAnimationComplete={hapticComplete}
 *     />
 *   );
 * }
 * ```
 */
export function useHapticOnComplete(
  hapticType: HapticIntent = 'selection',
  enabled = true
): () => void {
  return useCallback(() => {
    if (enabled) {
      haptic(hapticType);
    }
  }, [hapticType, enabled]);
}

// =============================================================================
// HAPTIC TRIGGER HELPERS
// =============================================================================

/**
 * Trigger haptic after a delay
 * Useful for coordinating with animations
 *
 * @param hapticType - Haptic type
 * @param delayMs - Delay in milliseconds
 */
export async function triggerHapticDelayed(
  hapticType: HapticIntent,
  delayMs: number
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  await haptic(hapticType);
}

/**
 * Trigger haptic sequence with timing
 * Useful for creating rhythmic feedback
 *
 * @param sequence - Array of [hapticType, delayMs] tuples
 *
 * @example
 * ```ts
 * // Success celebration: selection, pause, success
 * await triggerHapticSequence([
 *   ['selection', 0],
 *   ['selection', 100],
 *   ['success', 200],
 * ]);
 * ```
 */
export async function triggerHapticSequence(
  sequence: Array<[HapticIntent, number]>
): Promise<void> {
  for (const [type, delay] of sequence) {
    await triggerHapticDelayed(type, delay);
  }
}

// =============================================================================
// ANIMATION TIMING UTILITIES
// =============================================================================

/**
 * Estimate when a spring animation will settle
 * Based on the spring's natural frequency and damping ratio
 *
 * @param springConfig - Spring configuration
 * @returns Estimated settle time in milliseconds
 */
export function estimateSpringSettleTime(springConfig: SpringPreset | SpringOptions): number {
  const config = typeof springConfig === 'string' ? springs[springConfig] : springConfig;

  const { stiffness = 200, damping = 20, mass = 1 } = config;

  // Natural frequency
  const omega = Math.sqrt(stiffness / mass);

  // Damping ratio
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  // Settle time (time to reach 2% of initial amplitude)
  // For underdamped: t ≈ -ln(0.02) / (zeta * omega)
  // For overdamped: longer, use approximation
  if (zeta < 1) {
    // Underdamped
    return Math.ceil((-Math.log(0.02) / (zeta * omega)) * 1000);
  } else {
    // Overdamped - use slower pole
    const s1 = -zeta * omega + omega * Math.sqrt(zeta * zeta - 1);
    return Math.ceil((-Math.log(0.02) / Math.abs(s1)) * 1000);
  }
}

/**
 * Create a haptic timing based on spring settle time
 *
 * @param springConfig - Spring configuration
 * @param hapticType - Haptic type
 * @returns Object with spring config and estimated haptic delay
 */
export function createHapticTiming(
  springConfig: SpringPreset | SpringOptions,
  hapticType: HapticIntent = 'selection'
) {
  const settleTime = estimateSpringSettleTime(springConfig);

  return {
    spring: typeof springConfig === 'string' ? springs[springConfig] : springConfig,
    hapticDelay: Math.max(0, settleTime - 50), // Fire slightly before visual settle
    hapticType,
  };
}
