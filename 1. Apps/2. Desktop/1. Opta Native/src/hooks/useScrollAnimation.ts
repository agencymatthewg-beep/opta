/**
 * useScrollAnimation - Scroll-linked animation utilities
 *
 * Provides hooks for scroll-based animations including:
 * - Reveal animations when elements enter viewport
 * - Parallax effects (background moves slower than content)
 * - Scroll progress tracking
 *
 * Uses Intersection Observer for performance and Framer Motion
 * useScroll for smooth scroll-linked values.
 *
 * @example
 * ```tsx
 * // Reveal animation
 * const { ref, isInView } = useScrollReveal();
 * <motion.div
 *   ref={ref}
 *   initial={{ opacity: 0, y: 20 }}
 *   animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
 * />
 *
 * // Parallax effect
 * const { ref, y } = useParallax({ speed: 0.5 });
 * <motion.div ref={ref} style={{ y }} />
 *
 * // Scroll progress
 * const { scrollYProgress } = useScrollProgress();
 * <motion.div style={{ scaleX: scrollYProgress }} />
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
  useInView,
} from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

// =============================================================================
// SCROLL REVEAL HOOK
// =============================================================================

export interface UseScrollRevealOptions {
  /** Threshold for triggering (0-1, percentage of element visible) */
  threshold?: number;
  /** Whether to only trigger once */
  once?: boolean;
  /** Root margin for intersection observer */
  margin?: string;
  /** Delay before marking as in view (ms) */
  delay?: number;
}

export interface UseScrollRevealResult {
  ref: React.RefObject<HTMLDivElement | null>;
  isInView: boolean;
  /** Force trigger the reveal (useful for testing) */
  trigger: () => void;
}

/**
 * Hook for reveal animations when element enters viewport
 *
 * @param options - Configuration options
 * @returns Ref to attach and visibility state
 */
export function useScrollReveal(
  options: UseScrollRevealOptions = {}
): UseScrollRevealResult {
  const { threshold = 0.2, once = true, margin = '0px', delay = 0 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isInView, setIsInView] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Use Framer Motion's useInView for integration
  const inView = useInView(ref, {
    amount: threshold,
    once,
    margin: margin as `${number}px ${number}px ${number}px ${number}px`,
  });

  useEffect(() => {
    // If reduced motion, show immediately
    if (prefersReducedMotion) {
      setIsInView(true);
      return;
    }

    // Handle delay
    if (inView && !hasTriggered) {
      if (delay > 0) {
        const timer = setTimeout(() => {
          setIsInView(true);
          setHasTriggered(true);
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setIsInView(true);
        setHasTriggered(true);
      }
    }
  }, [inView, hasTriggered, delay, prefersReducedMotion]);

  const trigger = useCallback(() => {
    setIsInView(true);
    setHasTriggered(true);
  }, []);

  return { ref, isInView, trigger };
}

// =============================================================================
// PARALLAX HOOK
// =============================================================================

export interface UseParallaxOptions {
  /** Speed multiplier (0.5 = half speed, -0.5 = opposite direction) */
  speed?: number;
  /** Whether to clamp values to prevent overflow */
  clamp?: boolean;
  /** Use spring for smoother motion */
  smooth?: boolean;
  /** Spring stiffness when smooth is true */
  springStiffness?: number;
  /** Spring damping when smooth is true */
  springDamping?: number;
}

export interface UseParallaxResult {
  ref: React.RefObject<HTMLDivElement | null>;
  /** Y transform value to apply */
  y: MotionValue<number>;
  /** X transform value (for horizontal parallax) */
  x: MotionValue<number>;
  /** Progress through the element (0-1) */
  progress: MotionValue<number>;
}

/**
 * Hook for parallax scroll effects
 *
 * @param options - Configuration options
 * @returns Ref and motion values for transforms
 */
export function useParallax(options: UseParallaxOptions = {}): UseParallaxResult {
  const {
    speed = 0.5,
    clamp = true,
    smooth = true,
    springStiffness = 100,
    springDamping = 20,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Calculate parallax offset
  // When speed is 0.5, element moves at half the scroll speed
  // Negative speed moves opposite direction
  const rawY = useTransform(scrollYProgress, [0, 1], clamp ? [100 * speed, -100 * speed] : [200 * speed, -200 * speed]);
  const rawX = useTransform(scrollYProgress, [0, 1], [0, 0]); // Default no horizontal parallax

  // Apply spring smoothing
  const y = useSpring(rawY, {
    stiffness: smooth && !prefersReducedMotion ? springStiffness : 1000,
    damping: smooth && !prefersReducedMotion ? springDamping : 100,
  });

  const x = useSpring(rawX, {
    stiffness: smooth && !prefersReducedMotion ? springStiffness : 1000,
    damping: smooth && !prefersReducedMotion ? springDamping : 100,
  });

  return {
    ref,
    y: prefersReducedMotion ? rawX : y, // Return 0 if reduced motion
    x,
    progress: scrollYProgress,
  };
}

// =============================================================================
// SCROLL PROGRESS HOOK
// =============================================================================

export interface UseScrollProgressOptions {
  /** Target element (defaults to document) */
  target?: React.RefObject<HTMLElement>;
  /** Offset configuration */
  offset?: ['start' | 'center' | 'end', 'start' | 'center' | 'end'];
  /** Apply spring smoothing */
  smooth?: boolean;
}

export interface UseScrollProgressResult {
  /** Scroll progress (0-1) for X axis */
  scrollXProgress: MotionValue<number>;
  /** Scroll progress (0-1) for Y axis */
  scrollYProgress: MotionValue<number>;
  /** Smoothed Y progress with spring */
  smoothYProgress: MotionValue<number>;
  /** Smoothed X progress with spring */
  smoothXProgress: MotionValue<number>;
}

/**
 * Hook for tracking scroll progress
 *
 * @param options - Configuration options
 * @returns Motion values for scroll progress
 */
export function useScrollProgress(
  options: UseScrollProgressOptions = {}
): UseScrollProgressResult {
  const { target, smooth = true } = options;
  const prefersReducedMotion = useReducedMotion();

  const { scrollXProgress, scrollYProgress } = useScroll({
    target,
  });

  const smoothYProgress = useSpring(scrollYProgress, {
    stiffness: smooth && !prefersReducedMotion ? 100 : 1000,
    damping: smooth && !prefersReducedMotion ? 20 : 100,
  });

  const smoothXProgress = useSpring(scrollXProgress, {
    stiffness: smooth && !prefersReducedMotion ? 100 : 1000,
    damping: smooth && !prefersReducedMotion ? 20 : 100,
  });

  return {
    scrollXProgress,
    scrollYProgress,
    smoothYProgress,
    smoothXProgress,
  };
}

// =============================================================================
// SCROLL VELOCITY HOOK
// =============================================================================

export interface UseScrollVelocityResult {
  /** Current scroll velocity (pixels per second) */
  velocity: MotionValue<number>;
  /** Scroll direction: 1 (down), -1 (up), 0 (stationary) */
  direction: MotionValue<number>;
}

/**
 * Hook for tracking scroll velocity
 * Useful for hiding/showing headers on scroll
 *
 * @returns Motion values for velocity and direction
 */
export function useScrollVelocity(): UseScrollVelocityResult {
  const { scrollY } = useScroll();
  const [lastY, setLastY] = useState(0);
  const [lastTime, setLastTime] = useState(Date.now());

  // Calculate velocity from scroll changes
  const velocity = useTransform(scrollY, (y) => {
    const now = Date.now();
    const deltaTime = now - lastTime;
    const deltaY = y - lastY;

    setLastY(y);
    setLastTime(now);

    if (deltaTime === 0) return 0;
    return (deltaY / deltaTime) * 1000; // pixels per second
  });

  const direction = useTransform(velocity, (v) => {
    if (v > 10) return 1; // Scrolling down
    if (v < -10) return -1; // Scrolling up
    return 0; // Stationary
  });

  return { velocity, direction: direction as MotionValue<number> };
}

// =============================================================================
// SCROLL-LINKED OPACITY HOOK
// =============================================================================

export interface UseScrollOpacityOptions {
  /** Start fading at this scroll position (0-1) */
  fadeStart?: number;
  /** Complete fade at this scroll position (0-1) */
  fadeEnd?: number;
  /** Invert (fade in instead of out) */
  invert?: boolean;
}

export interface UseScrollOpacityResult {
  ref: React.RefObject<HTMLDivElement | null>;
  opacity: MotionValue<number>;
}

/**
 * Hook for scroll-linked opacity changes
 * Useful for hero sections that fade as you scroll
 *
 * @param options - Configuration options
 * @returns Ref and opacity motion value
 */
export function useScrollOpacity(
  options: UseScrollOpacityOptions = {}
): UseScrollOpacityResult {
  const { fadeStart = 0, fadeEnd = 0.5, invert = false } = options;
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const opacity = useTransform(
    scrollYProgress,
    [fadeStart, fadeEnd],
    invert ? [0, 1] : [1, 0]
  );

  // Skip fade effect for reduced motion
  const finalOpacity = useTransform(opacity, (o) =>
    prefersReducedMotion ? 1 : o
  );

  return { ref, opacity: finalOpacity };
}

// =============================================================================
// STAGGER ON SCROLL HOOK
// =============================================================================

export interface UseStaggerOnScrollOptions {
  /** Number of items to stagger */
  itemCount: number;
  /** Delay between items (ms) */
  staggerDelay?: number;
  /** Threshold for triggering */
  threshold?: number;
}

export interface UseStaggerOnScrollResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isInView: boolean;
  /** Get delay for specific item index */
  getItemDelay: (index: number) => number;
  /** Get animation state for specific item */
  getItemAnimation: (index: number) => 'hidden' | 'visible';
}

/**
 * Hook for staggered reveal on scroll
 * Items animate in sequence when container enters viewport
 *
 * @param options - Configuration options
 * @returns Container ref and stagger utilities
 */
export function useStaggerOnScroll(
  options: UseStaggerOnScrollOptions
): UseStaggerOnScrollResult {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { itemCount: _itemCount, staggerDelay = 50, threshold = 0.2 } = options;
  const { ref, isInView } = useScrollReveal({ threshold, once: true });
  const prefersReducedMotion = useReducedMotion();

  const getItemDelay = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_index: number): number => {
      if (prefersReducedMotion) return 0;
      return _index * staggerDelay;
    },
    [staggerDelay, prefersReducedMotion]
  );

  const getItemAnimation = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_index: number): 'hidden' | 'visible' => {
      if (!isInView) return 'hidden';
      return 'visible';
    },
    [isInView]
  );

  return {
    containerRef: ref,
    isInView,
    getItemDelay,
    getItemAnimation,
  };
}

// =============================================================================
// REVEAL VARIANTS
// =============================================================================

/**
 * Pre-built reveal animation variants
 * Use with useScrollReveal hook
 */
export const revealVariants = {
  /** Fade up from below */
  fadeUp: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 25 },
    },
  },

  /** Fade down from above */
  fadeDown: {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 25 },
    },
  },

  /** Fade in from left */
  fadeLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring', stiffness: 200, damping: 25 },
    },
  },

  /** Fade in from right */
  fadeRight: {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring', stiffness: 200, damping: 25 },
    },
  },

  /** Scale up with fade */
  scaleUp: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 25 },
    },
  },

  /** Obsidian ignition style reveal */
  ignition: {
    hidden: {
      opacity: 0,
      scale: 0.95,
      filter: 'brightness(0.5) blur(4px)',
    },
    visible: {
      opacity: 1,
      scale: 1,
      filter: 'brightness(1) blur(0px)',
      transition: { type: 'spring', stiffness: 150, damping: 20 },
    },
  },
} as const;

export default {
  useScrollReveal,
  useParallax,
  useScrollProgress,
  useScrollVelocity,
  useScrollOpacity,
  useStaggerOnScroll,
  revealVariants,
};
