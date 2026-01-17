/**
 * Ripple - Material-style click/tap feedback effect
 *
 * Creates expanding ripple from click point with optional glow pulse on tap.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * // Basic usage - wrap any clickable element
 * <Ripple>
 *   <button>Click me</button>
 * </Ripple>
 *
 * // With custom color
 * <Ripple color="rgba(168, 85, 247, 0.3)">
 *   <Card>Interactive card</Card>
 * </Ripple>
 *
 * // With glow pulse on mobile
 * <Ripple glowOnTap glowColor="rgba(168, 85, 247, 0.4)">
 *   <button>Tap me</button>
 * </Ripple>
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import {
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
  useRef,
  useState,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface RippleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface RippleProps {
  children: ReactNode;
  className?: string;
  /** Ripple color - defaults to white at 20% opacity */
  color?: string;
  /** Duration of ripple animation in ms - defaults to 400 */
  duration?: number;
  /** Whether to show glow pulse on tap (mobile) */
  glowOnTap?: boolean;
  /** Glow color for tap feedback */
  glowColor?: string;
  /** Disable ripple effect */
  disabled?: boolean;
  /** Additional props to spread on container */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Ripple({
  children,
  className,
  color = 'rgba(255, 255, 255, 0.2)',
  duration = 400,
  glowOnTap = false,
  glowColor = 'rgba(168, 85, 247, 0.4)',
  disabled = false,
  containerProps,
}: RippleProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<RippleInstance[]>([]);
  const [showGlow, setShowGlow] = useState(false);
  const nextRippleId = useRef(0);

  const createRipple = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || prefersReducedMotion) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Calculate ripple size to cover entire container
      const maxX = Math.max(x, rect.width - x);
      const maxY = Math.max(y, rect.height - y);
      const size = Math.sqrt(maxX * maxX + maxY * maxY) * 2;

      const newRipple: RippleInstance = {
        id: nextRippleId.current++,
        x,
        y,
        size,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, duration);
    },
    [disabled, prefersReducedMotion, duration]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      createRipple(e.clientX, e.clientY);
    },
    [createRipple]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      if (touch) {
        createRipple(touch.clientX, touch.clientY);

        // Show glow on mobile tap
        if (glowOnTap && !prefersReducedMotion) {
          setShowGlow(true);
          setTimeout(() => setShowGlow(false), 200);
        }
      }
    },
    [createRipple, glowOnTap, prefersReducedMotion]
  );

  // Spring config for ripple expansion
  const rippleTransition = {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      {...containerProps}
    >
      {children}

      {/* Ripple layer */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{
              opacity: 1,
              scale: 0,
              x: ripple.x - ripple.size / 2,
              y: ripple.y - ripple.size / 2,
            }}
            animate={{
              opacity: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={rippleTransition}
            className="pointer-events-none absolute rounded-full"
            style={{
              width: ripple.size,
              height: ripple.size,
              backgroundColor: color,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Glow pulse layer (mobile) */}
      <AnimatePresence>
        {showGlow && (
          <motion.span
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            className="pointer-events-none absolute inset-0 rounded-inherit"
            style={{
              boxShadow: `inset 0 0 24px ${glowColor}, 0 0 16px ${glowColor}`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// PRESET VARIANTS
// =============================================================================

/**
 * RippleButton - Pre-configured ripple for buttons
 */
export interface RippleButtonProps extends Omit<RippleProps, 'glowOnTap'> {
  children: ReactNode;
}

export function RippleButton({ children, ...props }: RippleButtonProps) {
  return (
    <Ripple
      color="rgba(255, 255, 255, 0.25)"
      glowOnTap
      glowColor="rgba(168, 85, 247, 0.3)"
      {...props}
    >
      {children}
    </Ripple>
  );
}

/**
 * RippleCard - Pre-configured ripple for cards with subtle effect
 */
export interface RippleCardProps extends Omit<RippleProps, 'color' | 'duration'> {
  children: ReactNode;
}

export function RippleCard({ children, ...props }: RippleCardProps) {
  return (
    <Ripple color="rgba(168, 85, 247, 0.15)" duration={500} {...props}>
      {children}
    </Ripple>
  );
}

/**
 * RipplePrimary - Pre-configured ripple with primary brand color
 */
export function RipplePrimary({ children, ...props }: RippleButtonProps) {
  return (
    <Ripple
      color="rgba(168, 85, 247, 0.3)"
      glowOnTap
      glowColor="rgba(168, 85, 247, 0.5)"
      {...props}
    >
      {children}
    </Ripple>
  );
}

export default Ripple;
