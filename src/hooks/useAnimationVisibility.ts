/**
 * useAnimationVisibility - Gates animations based on viewport visibility
 *
 * Pauses infinite/continuous animations when elements are off-screen
 * to save GPU cycles. Uses IntersectionObserver for efficient visibility detection.
 *
 * @see DESIGN_SYSTEM.md - Performance considerations
 */

import { useState, useEffect, useRef, RefObject } from 'react';

interface UseAnimationVisibilityOptions {
  /** Root margin for the intersection observer (default: "100px") */
  rootMargin?: string;
  /** Threshold for triggering visibility (default: 0) */
  threshold?: number;
  /** Whether to start as visible (useful for SSR) */
  initiallyVisible?: boolean;
}

interface UseAnimationVisibilityReturn {
  /** Ref to attach to the element being observed */
  ref: RefObject<HTMLDivElement | null>;
  /** Whether the element is currently visible */
  isVisible: boolean;
  /** Animation state that can be passed to Framer Motion */
  animationState: 'visible' | 'hidden';
}

/**
 * Hook to control animations based on element visibility.
 *
 * Usage:
 * ```tsx
 * const { ref, isVisible } = useAnimationVisibility();
 *
 * return (
 *   <motion.div
 *     ref={ref}
 *     animate={isVisible ? 'active' : 'dormant'}
 *     variants={glowPulse}
 *   />
 * );
 * ```
 */
export function useAnimationVisibility(
  options: UseAnimationVisibilityOptions = {}
): UseAnimationVisibilityReturn {
  const {
    rootMargin = '100px',
    threshold = 0,
    initiallyVisible = false,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(initiallyVisible);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check if IntersectionObserver is available (not in SSR)
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return {
    ref,
    isVisible,
    animationState: isVisible ? 'visible' : 'hidden',
  };
}

/**
 * Variant of the hook that accepts an existing ref.
 * Useful when you already have a ref attached to the element.
 */
export function useAnimationVisibilityWithRef<T extends Element>(
  elementRef: RefObject<T | null>,
  options: Omit<UseAnimationVisibilityOptions, 'initiallyVisible'> & {
    initiallyVisible?: boolean;
  } = {}
): Omit<UseAnimationVisibilityReturn, 'ref'> {
  const {
    rootMargin = '100px',
    threshold = 0,
    initiallyVisible = false,
  } = options;

  const [isVisible, setIsVisible] = useState(initiallyVisible);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, rootMargin, threshold]);

  return {
    isVisible,
    animationState: isVisible ? 'visible' : 'hidden',
  };
}

export default useAnimationVisibility;
