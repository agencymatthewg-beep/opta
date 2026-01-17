/**
 * useSwipeNavigation - Magic Mouse swipe gesture detection
 *
 * Detects horizontal swipe gestures from Magic Mouse/trackpad and triggers
 * back/forward navigation similar to browser behavior.
 *
 * Magic Mouse generates wheel events with deltaX for horizontal scrolling.
 * We accumulate deltaX and trigger navigation when threshold is reached.
 *
 * @example
 * ```tsx
 * const { swipeProgress, swipeDirection } = useSwipeNavigation({
 *   onSwipeLeft: goForward,
 *   onSwipeRight: goBack,
 *   canSwipeLeft: canGoForward,
 *   canSwipeRight: canGoBack,
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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
}

export interface SwipeNavigationState {
  /** Current swipe progress (-1 to 1, negative = right/back, positive = left/forward) */
  swipeProgress: number;
  /** Current swipe direction */
  swipeDirection: SwipeDirection;
  /** Whether a swipe is currently in progress */
  isSwiping: boolean;
}

/**
 * Hook for detecting Magic Mouse swipe gestures.
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  threshold = 100,
  enabled = true,
}: UseSwipeNavigationOptions): SwipeNavigationState {
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Accumulated delta for gesture detection
  const accumulatedDeltaRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const isGestureActiveRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  // Reset timeout ref
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Reset swipe state after gesture ends.
   */
  const resetSwipe = useCallback(() => {
    accumulatedDeltaRef.current = 0;
    isGestureActiveRef.current = false;
    hasTriggeredRef.current = false;
    setSwipeProgress(0);
    setSwipeDirection(null);
    setIsSwiping(false);
  }, []);

  /**
   * Handle wheel events from Magic Mouse.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled) return;

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
      lastWheelTimeRef.current = now;

      // If it's been a while since last wheel event, start fresh
      if (timeSinceLastWheel > 150) {
        accumulatedDeltaRef.current = 0;
        hasTriggeredRef.current = false;
      }

      // Accumulate delta (negative deltaX = swipe right = go back)
      accumulatedDeltaRef.current += event.deltaX;

      // Determine direction and check if allowed
      const delta = accumulatedDeltaRef.current;
      const direction: SwipeDirection = delta > 0 ? 'left' : delta < 0 ? 'right' : null;

      // Check if this direction is allowed
      const isAllowed =
        (direction === 'left' && canSwipeLeft) ||
        (direction === 'right' && canSwipeRight);

      if (!isAllowed) {
        // Apply resistance - reduce accumulated delta
        accumulatedDeltaRef.current *= 0.5;
      }

      // Calculate progress (clamped -1 to 1)
      const progress = Math.max(-1, Math.min(1, accumulatedDeltaRef.current / threshold));

      // Update state
      setSwipeProgress(progress);
      setSwipeDirection(direction);
      setIsSwiping(true);
      isGestureActiveRef.current = true;

      // Check if threshold reached and navigation should trigger
      if (!hasTriggeredRef.current && Math.abs(accumulatedDeltaRef.current) >= threshold) {
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
    [enabled, canSwipeLeft, canSwipeRight, threshold, onSwipeLeft, onSwipeRight, resetSwipe]
  );

  // Attach wheel event listener
  useEffect(() => {
    if (!enabled) return;

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [enabled, handleWheel]);

  return {
    swipeProgress,
    swipeDirection,
    isSwiping,
  };
}

export default useSwipeNavigation;
