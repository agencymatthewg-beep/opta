/**
 * useMicroInteraction - Hook for subtle hover position effects
 *
 * Tracks mouse position within an element and applies subtle
 * transform shifts toward the cursor position. Creates a
 * premium, responsive feel.
 *
 * Per Gemini research:
 * - "Micro-interactions reward user engagement"
 * - "Elements subtly respond to cursor position"
 * - "Keep effects subtle (max 2-4px movement)"
 *
 * @example
 * ```tsx
 * function Card() {
 *   const { ref, style, handlers } = useMicroInteraction({ intensity: 3 });
 *
 *   return (
 *     <motion.div ref={ref} style={style} {...handlers}>
 *       Card content
 *     </motion.div>
 *   );
 * }
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useRef, useCallback } from 'react';
import { useMotionValue, useSpring, useTransform, type MotionStyle } from 'framer-motion';
import { springs } from '@/lib/animation/springs';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface UseMicroInteractionOptions {
  /** Max pixel movement (default: 3) */
  intensity?: number;
  /** Whether the effect is enabled */
  enabled?: boolean;
  /** Rotation effect intensity in degrees (default: 0 = disabled) */
  rotationIntensity?: number;
  /** Scale effect on hover (default: 1 = no scale) */
  hoverScale?: number;
  /** Spring preset for the animation */
  springPreset?: 'gentle' | 'smooth' | 'snappy';
}

export interface UseMicroInteractionReturn {
  /** Ref to attach to the element */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Motion style object to spread onto motion element */
  style: MotionStyle;
  /** Event handlers to spread onto the element */
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onMouseEnter: () => void;
  };
  /** Whether the effect is currently active */
  isActive: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMicroInteraction(
  options: UseMicroInteractionOptions = {}
): UseMicroInteractionReturn {
  const {
    intensity = 3,
    enabled = true,
    rotationIntensity = 0,
    hoverScale = 1,
    springPreset = 'gentle',
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Disable if user prefers reduced motion
  const isEnabled = enabled && !prefersReducedMotion;

  // Raw mouse position (normalized -1 to 1)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Hover state
  const isHovered = useMotionValue(0);

  // Get spring config
  const springConfig = springs[springPreset];

  // Apply spring physics
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);
  const springHover = useSpring(isHovered, springs.button);

  // Transform to pixel movement
  const x = useTransform(springX, [-1, 1], [-intensity, intensity]);
  const y = useTransform(springY, [-1, 1], [-intensity, intensity]);

  // Optional rotation transform (tilt effect)
  const rotateX = useTransform(
    springY,
    [-1, 1],
    [rotationIntensity, -rotationIntensity]
  );
  const rotateY = useTransform(
    springX,
    [-1, 1],
    [-rotationIntensity, rotationIntensity]
  );

  // Optional scale on hover
  const scale = useTransform(springHover, [0, 1], [1, hoverScale]);

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isEnabled || !ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize to -1 to 1 based on cursor distance from center
      const normalizedX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      const normalizedY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));

      mouseX.set(normalizedX);
      mouseY.set(normalizedY);
    },
    [isEnabled, mouseX, mouseY]
  );

  // Mouse leave handler
  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    isHovered.set(0);
  }, [mouseX, mouseY, isHovered]);

  // Mouse enter handler
  const handleMouseEnter = useCallback(() => {
    isHovered.set(1);
  }, [isHovered]);

  // Build motion style
  const style: MotionStyle = isEnabled
    ? {
        x,
        y,
        rotateX: rotationIntensity > 0 ? rotateX : 0,
        rotateY: rotationIntensity > 0 ? rotateY : 0,
        scale: hoverScale !== 1 ? scale : 1,
        transformStyle: rotationIntensity > 0 ? 'preserve-3d' : undefined,
      }
    : {};

  return {
    ref,
    style,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onMouseEnter: handleMouseEnter,
    },
    isActive: isEnabled,
  };
}

// =============================================================================
// TILT VARIANT
// =============================================================================

/**
 * useTiltEffect - Specialized hook for card tilt effects
 *
 * Applies a 3D tilt effect based on cursor position.
 * Good for cards, images, and interactive panels.
 *
 * @example
 * ```tsx
 * function Card() {
 *   const { ref, style, handlers } = useTiltEffect({ maxTilt: 10 });
 *
 *   return (
 *     <motion.div
 *       ref={ref}
 *       style={{ ...style, perspective: 1000 }}
 *       {...handlers}
 *     >
 *       Card content
 *     </motion.div>
 *   );
 * }
 * ```
 */
export interface UseTiltEffectOptions {
  /** Max tilt angle in degrees (default: 8) */
  maxTilt?: number;
  /** Scale on hover (default: 1.02) */
  hoverScale?: number;
  /** Whether the effect is enabled */
  enabled?: boolean;
}

export function useTiltEffect(options: UseTiltEffectOptions = {}) {
  const { maxTilt = 8, hoverScale = 1.02, enabled = true } = options;

  return useMicroInteraction({
    intensity: 0, // No position shift
    rotationIntensity: maxTilt,
    hoverScale,
    enabled,
    springPreset: 'gentle',
  });
}

// =============================================================================
// MAGNETIC EFFECT VARIANT
// =============================================================================

/**
 * useMagneticEffect - Elements that pull toward cursor
 *
 * Creates a magnetic attraction effect where the element
 * moves toward the cursor position.
 *
 * @example
 * ```tsx
 * function MagneticButton() {
 *   const { ref, style, handlers } = useMagneticEffect({ strength: 0.3 });
 *
 *   return (
 *     <motion.button ref={ref} style={style} {...handlers}>
 *       Click me
 *     </motion.button>
 *   );
 * }
 * ```
 */
export interface UseMagneticEffectOptions {
  /** Magnetic strength (0-1, default: 0.2) */
  strength?: number;
  /** Max distance in pixels (default: 40) */
  maxDistance?: number;
  /** Whether the effect is enabled */
  enabled?: boolean;
}

export function useMagneticEffect(options: UseMagneticEffectOptions = {}) {
  const { strength = 0.2, maxDistance = 40, enabled = true } = options;

  // Calculate intensity based on strength and max distance
  const intensity = maxDistance * strength;

  return useMicroInteraction({
    intensity,
    enabled,
    hoverScale: 1.05,
    springPreset: 'smooth',
  });
}

export default useMicroInteraction;
