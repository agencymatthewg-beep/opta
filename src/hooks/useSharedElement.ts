/**
 * useSharedElement - Hook for shared element transitions
 *
 * Enables smooth morphing animations between elements across different
 * views or states. Elements with the same shared ID will animate
 * from one position to another.
 *
 * Per Gemini research:
 * - "Visual continuity - Shared element transitions prevent jarring cuts"
 * - "Elements morph smoothly between positions"
 *
 * @example
 * ```tsx
 * // In list view
 * function CardThumbnail({ id }: { id: string }) {
 *   const { ref, style, layoutId } = useSharedElement(`card-${id}`);
 *   return (
 *     <motion.div ref={ref} style={style} layoutId={layoutId}>
 *       <img src="..." />
 *     </motion.div>
 *   );
 * }
 *
 * // In detail view - same layoutId enables smooth transition
 * function CardDetail({ id }: { id: string }) {
 *   const { ref, style, layoutId } = useSharedElement(`card-${id}`);
 *   return (
 *     <motion.div ref={ref} style={style} layoutId={layoutId}>
 *       <img src="..." className="full-size" />
 *     </motion.div>
 *   );
 * }
 * ```
 */

import { useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useMotionValue, useSpring, useTransform, MotionStyle } from 'framer-motion';
import {
  registerSharedElement,
  getSharedElementRect,
  calculateTransform,
} from '@/lib/animation/transitions';
import { springs } from '@/lib/animation/springs';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface UseSharedElementOptions {
  /** Spring preset for the transition */
  springPreset?: 'snappy' | 'smooth' | 'bouncy' | 'gentle';
  /** Whether to animate opacity during transition */
  animateOpacity?: boolean;
  /** Callback when transition starts */
  onTransitionStart?: () => void;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
}

export interface UseSharedElementReturn {
  /** Ref to attach to the element */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Motion style to apply for animation */
  style: MotionStyle;
  /** Layout ID for Framer Motion's layout animations */
  layoutId: string;
  /** Whether there's a previous position to animate from */
  hasPrevious: boolean;
  /** Manually trigger position update */
  updatePosition: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useSharedElement(
  id: string,
  options: UseSharedElementOptions = {}
): UseSharedElementReturn {
  const {
    springPreset = 'smooth',
    animateOpacity = true,
    onTransitionStart,
    onTransitionComplete,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Get spring configuration
  const springConfig = springs[springPreset];

  // Motion values for animation
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawScaleX = useMotionValue(1);
  const rawScaleY = useMotionValue(1);
  const rawOpacity = useMotionValue(1);

  // Apply spring physics to motion values
  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);
  const scaleX = useSpring(rawScaleX, springConfig);
  const scaleY = useSpring(rawScaleY, springConfig);
  const opacity = useSpring(rawOpacity, { ...springConfig, stiffness: springConfig.stiffness * 1.5 });

  // Track if we have a previous position
  const hasPreviousRef = useRef(false);

  // Update position in registry
  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    registerSharedElement(id, rect);
  }, [id]);

  // Layout effect to handle transitions
  useLayoutEffect(() => {
    if (!ref.current) return;

    const currentRect = ref.current.getBoundingClientRect();
    const previousRect = getSharedElementRect(id);

    if (previousRect && !prefersReducedMotion) {
      // Calculate transform from previous position
      const transform = calculateTransform(previousRect, currentRect);

      // Set initial values (element appears at previous position)
      rawX.set(transform.x);
      rawY.set(transform.y);
      rawScaleX.set(transform.scaleX);
      rawScaleY.set(transform.scaleY);

      if (animateOpacity) {
        rawOpacity.set(0.8);
      }

      hasPreviousRef.current = true;
      onTransitionStart?.();

      // Animate to final position (0, 0, 1, 1)
      // The spring will handle the animation automatically
      requestAnimationFrame(() => {
        rawX.set(0);
        rawY.set(0);
        rawScaleX.set(1);
        rawScaleY.set(1);
        rawOpacity.set(1);

        // Estimate completion time based on spring config
        const estimatedDuration = Math.max(300, 1000 / (springConfig.damping / 10));
        setTimeout(() => {
          onTransitionComplete?.();
        }, estimatedDuration);
      });
    } else {
      hasPreviousRef.current = false;
    }

    // Store current position for future transitions
    registerSharedElement(id, currentRect);

    // Update on resize
    const resizeObserver = new ResizeObserver(() => {
      if (ref.current) {
        registerSharedElement(id, ref.current.getBoundingClientRect());
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
      // Update final position before unmount
      if (ref.current) {
        registerSharedElement(id, ref.current.getBoundingClientRect());
      }
    };
  }, [id, prefersReducedMotion, animateOpacity, onTransitionStart, onTransitionComplete, rawX, rawY, rawScaleX, rawScaleY, rawOpacity, springConfig.damping]);

  // Combine transforms into a single transform string
  const transformX = useTransform(x, (val) => `translateX(${val}px)`);
  const transformY = useTransform(y, (val) => `translateY(${val}px)`);

  // Build motion style
  const style: MotionStyle = useMemo(() => {
    if (prefersReducedMotion) {
      return {};
    }

    return {
      x,
      y,
      scaleX,
      scaleY,
      opacity: animateOpacity ? opacity : 1,
      transformOrigin: 'top left',
    };
  }, [prefersReducedMotion, x, y, scaleX, scaleY, opacity, animateOpacity, transformX, transformY]);

  return {
    ref,
    style,
    layoutId: id,
    hasPrevious: hasPreviousRef.current,
    updatePosition,
  };
}

// =============================================================================
// SIMPLIFIED HOOK FOR LAYOUT ANIMATIONS
// =============================================================================

/**
 * Simplified hook that just provides a layoutId for Framer Motion's
 * built-in layout animations. Use this when you want automatic
 * layout transitions without manual control.
 *
 * @example
 * ```tsx
 * function Card({ id }: { id: string }) {
 *   const layoutId = useLayoutId('card', id);
 *   return <motion.div layoutId={layoutId} layout>...</motion.div>;
 * }
 * ```
 */
export function useLayoutId(namespace: string, id: string | number): string {
  return useMemo(() => `${namespace}-${id}`, [namespace, id]);
}

export default useSharedElement;
