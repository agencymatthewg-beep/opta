/**
 * MicroInteraction - Component wrapper for micro-interaction effects
 *
 * Applies subtle position/rotation/scale effects based on cursor position.
 * Creates premium, responsive hover feedback.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MicroInteraction>
 *   <Card>Content</Card>
 * </MicroInteraction>
 *
 * // With tilt effect
 * <MicroInteraction variant="tilt" maxTilt={10}>
 *   <Image src="..." />
 * </MicroInteraction>
 *
 * // Magnetic button
 * <MicroInteraction variant="magnetic" strength={0.3}>
 *   <Button>Click me</Button>
 * </MicroInteraction>
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import {
  useMicroInteraction,
  useTiltEffect,
  useMagneticEffect,
  type UseMicroInteractionOptions,
  type UseTiltEffectOptions,
  type UseMagneticEffectOptions,
} from '@/hooks/useMicroInteraction';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface BaseMicroInteractionProps {
  children: ReactNode;
  className?: string;
  /** Disable the effect */
  disabled?: boolean;
}

interface StandardMicroInteractionProps
  extends BaseMicroInteractionProps,
    Omit<UseMicroInteractionOptions, 'enabled'> {
  variant?: 'standard';
}

interface TiltMicroInteractionProps
  extends BaseMicroInteractionProps,
    Omit<UseTiltEffectOptions, 'enabled'> {
  variant: 'tilt';
}

interface MagneticMicroInteractionProps
  extends BaseMicroInteractionProps,
    Omit<UseMagneticEffectOptions, 'enabled'> {
  variant: 'magnetic';
}

export type MicroInteractionProps =
  | StandardMicroInteractionProps
  | TiltMicroInteractionProps
  | MagneticMicroInteractionProps;

// =============================================================================
// COMPONENT
// =============================================================================

export function MicroInteraction(props: MicroInteractionProps) {
  const { children, className, disabled = false, variant = 'standard' } = props;
  const prefersReducedMotion = useReducedMotion();

  // Determine which hook to use based on variant
  const getHookResult = () => {
    const enabled = !disabled && !prefersReducedMotion;

    switch (variant) {
      case 'tilt':
        return useTiltEffect({
          maxTilt: (props as TiltMicroInteractionProps).maxTilt,
          hoverScale: (props as TiltMicroInteractionProps).hoverScale,
          enabled,
        });

      case 'magnetic':
        return useMagneticEffect({
          strength: (props as MagneticMicroInteractionProps).strength,
          maxDistance: (props as MagneticMicroInteractionProps).maxDistance,
          enabled,
        });

      default:
        return useMicroInteraction({
          intensity: (props as StandardMicroInteractionProps).intensity,
          rotationIntensity: (props as StandardMicroInteractionProps).rotationIntensity,
          hoverScale: (props as StandardMicroInteractionProps).hoverScale,
          springPreset: (props as StandardMicroInteractionProps).springPreset,
          enabled,
        });
    }
  };

  const { ref, style, handlers, isActive } = getHookResult();

  // If disabled or reduced motion, render without effects
  if (!isActive) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{
        ...style,
        perspective: variant === 'tilt' ? 1000 : undefined,
      }}
      className={cn('will-change-transform', className)}
      {...handlers}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// SPECIALIZED COMPONENTS
// =============================================================================

/**
 * TiltCard - Card with 3D tilt effect
 */
export interface TiltCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  children: ReactNode;
  maxTilt?: number;
  hoverScale?: number;
  disabled?: boolean;
}

export function TiltCard({
  children,
  className,
  maxTilt = 8,
  hoverScale = 1.02,
  disabled = false,
  ...motionProps
}: TiltCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, style, handlers, isActive } = useTiltEffect({
    maxTilt,
    hoverScale,
    enabled: !disabled && !prefersReducedMotion,
  });

  if (!isActive) {
    return (
      <div className={className} {...(motionProps as any)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      style={{ ...style, perspective: 1000 }}
      className={cn('will-change-transform', className)}
      {...handlers}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

/**
 * MagneticButton - Button with magnetic hover effect
 */
export interface MagneticButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  children: ReactNode;
  strength?: number;
  maxDistance?: number;
  disabled?: boolean;
}

export function MagneticButton({
  children,
  className,
  strength = 0.2,
  maxDistance = 40,
  disabled = false,
  ...motionProps
}: MagneticButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, style, handlers, isActive } = useMagneticEffect({
    strength,
    maxDistance,
    enabled: !disabled && !prefersReducedMotion,
  });

  if (!isActive) {
    return (
      <button className={className} disabled={disabled} {...(motionProps as any)}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      // @ts-ignore - ref type mismatch between div and button
      ref={ref}
      style={style}
      className={cn('will-change-transform', className)}
      disabled={disabled}
      onMouseMove={handlers.onMouseMove}
      onMouseLeave={handlers.onMouseLeave}
      onMouseEnter={handlers.onMouseEnter}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
}

/**
 * HoverShift - Simple position shift on hover
 */
export interface HoverShiftProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  disabled?: boolean;
}

export function HoverShift({
  children,
  className,
  intensity = 2,
  disabled = false,
}: HoverShiftProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, style, handlers, isActive } = useMicroInteraction({
    intensity,
    enabled: !disabled && !prefersReducedMotion,
  });

  if (!isActive) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={style}
      className={cn('will-change-transform', className)}
      {...handlers}
    >
      {children}
    </motion.div>
  );
}

export default MicroInteraction;
