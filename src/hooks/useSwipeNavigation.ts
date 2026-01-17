/**
 * useSwipeNavigation - Magic Mouse/Trackpad swipe gesture detection
 *
 * Detects horizontal swipe gestures from Magic Mouse/trackpad and triggers
 * back/forward navigation similar to browser behavior.
 *
 * Features:
 * - Magic Mouse horizontal scroll detection
 * - Trackpad two-finger swipe detection
 * - Rubber band effect at navigation boundaries
 * - Velocity-based triggering for natural feel
 * - Reduced motion support
 *
 * @example
 * ```tsx
 * const { swipeProgress, swipeDirection, rubberBandOffset } = useSwipeNavigation({
 *   onSwipeLeft: goForward,
 *   onSwipeRight: goBack,
 *   canSwipeLeft: canGoForward,
 *   canSwipeRight: canGoBack,
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

export type SwipeDirection = 'left' | 'right' | null;

export interface UseSwipeNavigationOptions {
  /** Called when swiping left (go forward) */
  onSwipeLeft?: () => void;
  /** Called when swiping right (go back) */
  onSwipeRight?: () => void;
  /** Whether left swipe is allowed */
  canSwipeLeft?: boolean;
  /** Whether right swipe is allowed */
  canSwipeRight?: boolean;
  /** Threshold in pixels to trigger navigation (default: 100) */
  threshold?: number;
  /** Enabled state (default: true) */
  enabled?: boolean;
  /** Velocity threshold to trigger (default: 0.3) */
  velocityThreshold?: number;
  /** Maximum rubber band stretch in pixels (default: 50) */
  maxRubberBand?: number;
}

export interface SwipeNavigationState {
  /** Current swipe progress (-1 to 1, negative = right/back, positive = left/forward) */
  swipeProgress: number;
  /** Current swipe direction */
  swipeDirection: SwipeDirection;
  /** Whether a swipe is currently in progress */
  isSwiping: boolean;
  /** Rubber band offset when at boundary (positive = right edge, negative = left edge) */
  rubberBandOffset: number;
  /** Whether rubber band is active (swiping at boundary) */
  isAtBoundary: boolean;
}

/**
 * Rubber band easing function - applies resistance as offset increases.
 * Creates a natural "stretching" feel similar to iOS.
 */
function rubberBandEasing(offset: number, max: number): number {
  const absOffset = Math.abs(offset);
  const sign = offset >= 0 ? 1 : -1;

  // Use a logarithmic curve for natural rubber band feel
  // As offset approaches max, resistance increases dramatically
  const resistance = 1 - Math.min(absOffset / (max * 3), 0.8);
  const easedOffset = absOffset * resistance;

  return Math.min(easedOffset, max) * sign;
}

/**
 * Hook for detecting Magic Mouse/trackpad swipe gestures.
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  threshold = 100,
  enabled = true,
  velocityThreshold = 0.3,
  maxRubberBand = 50,
}: UseSwipeNavigationOptions): SwipeNavigationState {
  const prefersReducedMotion = useReducedMotion();

  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [rubberBandOffset, setRubberBandOffset] = useState(0);
  const [isAtBoundary, setIsAtBoundary] = useState(false);

  // Accumulated delta for gesture detection
  const accumulatedDeltaRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const isGestureActiveRef = useRef(false);
  const hasTriggeredRef = useRef(false);
  const velocityRef = useRef(0);
  const lastDeltaRef = useRef(0);

  // Reset timeout ref
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rubberBandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Reset swipe state after gesture ends.
   */
  const resetSwipe = useCallback(() => {
    accumulatedDeltaRef.current = 0;
    isGestureActiveRef.current = false;
    hasTriggeredRef.current = false;
    velocityRef.current = 0;
    lastDeltaRef.current = 0;
    setSwipeProgress(0);
    setSwipeDirection(null);
    setIsSwiping(false);
  }, []);

  /**
   * Animate rubber band back to zero.
   */
  const resetRubberBand = useCallback(() => {
    if (prefersReducedMotion) {
      setRubberBandOffset(0);
      setIsAtBoundary(false);
      return;
    }

    // Animate back with spring-like motion
    const animate = () => {
      setRubberBandOffset((current) => {
        const next = current * 0.85; // Decay factor
        if (Math.abs(next) < 0.5) {
          setIsAtBoundary(false);
          return 0;
        }
        requestAnimationFrame(animate);
        return next;
      });
    };
    requestAnimationFrame(animate);
  }, [prefersReducedMotion]);

  /**
   * Handle wheel events from Magic Mouse/trackpad.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled) return;

      // Skip if reduced motion is preferred
      if (prefersReducedMotion) return;

      // Ignore vertical scrolling (deltaY dominant)
      // Magic Mouse horizontal swipes have larger deltaX
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) * 1.5) {
        return;
      }

      // Ignore small movements (noise)
      if (Math.abs(event.deltaX) < 2) {
        return;
      }

      const now = Date.now();
      const timeSinceLastWheel = now - lastWheelTimeRef.current;
      const deltaTime = Math.max(timeSinceLastWheel, 1) / 1000; // Convert to seconds
      lastWheelTimeRef.current = now;

      // If it's been a while since last wheel event, start fresh
      if (timeSinceLastWheel > 150) {
        accumulatedDeltaRef.current = 0;
        hasTriggeredRef.current = false;
        velocityRef.current = 0;
      }

      // Calculate velocity (pixels per second)
      velocityRef.current = event.deltaX / deltaTime;

      // Accumulate delta (negative deltaX = swipe right = go back)
      accumulatedDeltaRef.current += event.deltaX;
      lastDeltaRef.current = event.deltaX;

      // Determine direction and check if allowed
      const delta = accumulatedDeltaRef.current;
      const direction: SwipeDirection = delta > 0 ? 'left' : delta < 0 ? 'right' : null;

      // Check if this direction is allowed
      const isAllowed =
        (direction === 'left' && canSwipeLeft) ||
        (direction === 'right' && canSwipeRight);

      if (!isAllowed) {
        // Apply rubber band effect at boundary
        setIsAtBoundary(true);
        const rubberOffset = rubberBandEasing(delta, maxRubberBand);
        setRubberBandOffset(rubberOffset);

        // Apply strong resistance to accumulated delta
        accumulatedDeltaRef.current *= 0.3;

        // Clear any existing rubber band reset
        if (rubberBandTimeoutRef.current) {
          clearTimeout(rubberBandTimeoutRef.current);
        }

        // Reset rubber band after gesture ends
        rubberBandTimeoutRef.current = setTimeout(resetRubberBand, 150);

        // Still show some progress for visual feedback
        const resistedProgress = Math.max(-0.3, Math.min(0.3, delta / (threshold * 3)));
        setSwipeProgress(resistedProgress);
      } else {
        setIsAtBoundary(false);
        setRubberBandOffset(0);

        // Calculate progress (clamped -1 to 1)
        const progress = Math.max(-1, Math.min(1, delta / threshold));
        setSwipeProgress(progress);
      }

      // Update state
      setSwipeDirection(direction);
      setIsSwiping(true);
      isGestureActiveRef.current = true;

      // Check if threshold reached and navigation should trigger
      // Also check velocity for quick flick gestures
      const velocityTrigger = Math.abs(velocityRef.current) > velocityThreshold * 1000 &&
        Math.abs(delta) > threshold * 0.5;
      const distanceTrigger = Math.abs(delta) >= threshold;

      if (!hasTriggeredRef.current && isAllowed && (distanceTrigger || velocityTrigger)) {
        hasTriggeredRef.current = true;

        if (direction === 'left' && canSwipeLeft && onSwipeLeft) {
          onSwipeLeft();
        } else if (direction === 'right' && canSwipeRight && onSwipeRight) {
          onSwipeRight();
        }

        // Reset after navigation
        setTimeout(resetSwipe, 100);
      }

      // Clear existing reset timeout
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      // Set timeout to reset if no more wheel events
      resetTimeoutRef.current = setTimeout(() => {
        if (!hasTriggeredRef.current) {
          // Animate back to zero
          setSwipeProgress(0);
          setTimeout(resetSwipe, 200);
        }
      }, 150);

      // Prevent default to avoid page scrolling during gesture
      if (Math.abs(delta) > 10) {
        event.preventDefault();
      }
    },
    [
      enabled,
      prefersReducedMotion,
      canSwipeLeft,
      canSwipeRight,
      threshold,
      velocityThreshold,
      maxRubberBand,
      onSwipeLeft,
      onSwipeRight,
      resetSwipe,
      resetRubberBand,
    ]
  );

  // Attach wheel event listener
  useEffect(() => {
    if (!enabled || prefersReducedMotion) return;

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      if (rubberBandTimeoutRef.current) {
        clearTimeout(rubberBandTimeoutRef.current);
      }
    };
  }, [enabled, prefersReducedMotion, handleWheel]);

  return {
    swipeProgress,
    swipeDirection,
    isSwiping,
    rubberBandOffset,
    isAtBoundary,
  };
}

export default useSwipeNavigation;
