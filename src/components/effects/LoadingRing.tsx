/**
 * LoadingRing Component
 *
 * Ring-synchronized loading pulse component that connects loading states
 * to the Opta Ring visual language.
 *
 * Features:
 * - Ring enters 'processing' state during loading
 * - Pulse syncs with loading progress if available
 * - Indeterminate: continuous pulse at 1Hz
 * - Determinate: pulse intensity = progress %
 * - Complete: ring flashes then returns to active
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 */

import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { OptaRing } from '@/components/OptaRing';
import type { RingSize } from '@/components/OptaRing3D/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LoadingRingProps {
  /** Whether loading is active */
  isLoading: boolean;
  /** Loading progress (0-100), undefined for indeterminate */
  progress?: number;
  /** Size of the ring */
  size?: RingSize;
  /** Pulse frequency in Hz for indeterminate state (default 1) */
  pulseFrequency?: number;
  /** Flash on completion */
  flashOnComplete?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when loading completes */
  onComplete?: () => void;
}

// =============================================================================
// PROGRESS RING OVERLAY
// =============================================================================

interface ProgressRingOverlayProps {
  progress: number;
  size: number;
  reducedMotion: boolean;
}

function ProgressRingOverlay({ progress, size, reducedMotion }: ProgressRingOverlayProps) {
  const strokeWidth = 3;
  const padding = 6; // Space between ring image and progress arc
  const radius = (size / 2) - strokeWidth - padding;
  const circumference = radius * 2 * Math.PI;

  // Animate progress smoothly
  const progressValue = useMotionValue(0);
  const smoothProgress = useSpring(progressValue, {
    stiffness: 100,
    damping: 20,
  });

  // Update progress
  useEffect(() => {
    progressValue.set(progress);
  }, [progress, progressValue]);

  // Transform progress to stroke offset
  const strokeDashoffset = useTransform(
    smoothProgress,
    [0, 100],
    [circumference, 0]
  );

  // Calculate glow intensity based on progress
  const glowIntensity = useMemo(() => {
    return 0.3 + (progress / 100) * 0.4;
  }, [progress]);

  if (reducedMotion) {
    // Static version for reduced motion
    const staticOffset = circumference - (progress / 100) * circumference;
    return (
      <svg
        width={size}
        height={size}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(147, 51, 234)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={staticOffset}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Animated progress ring */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(147, 51, 234)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{
          strokeDashoffset,
          filter: `drop-shadow(0 0 ${6 + glowIntensity * 10}px rgba(147, 51, 234, ${glowIntensity}))`,
        }}
      />
    </svg>
  );
}

// =============================================================================
// INDETERMINATE PULSE OVERLAY
// =============================================================================

interface IndeterminatePulseProps {
  size: number;
  frequency: number;
  reducedMotion: boolean;
}

function IndeterminatePulse({ size, frequency, reducedMotion }: IndeterminatePulseProps) {
  const duration = 1 / frequency;

  if (reducedMotion) {
    return (
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size * 1.2,
          height: size * 1.2,
          boxShadow: '0 0 30px rgba(147, 51, 234, 0.3)',
        }}
      />
    );
  }

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size * 1.2,
        height: size * 1.2,
        left: '50%',
        top: '50%',
      }}
      initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
      animate={{
        opacity: [0.2, 0.5, 0.2],
        scale: [0.95, 1.05, 0.95],
        x: '-50%',
        y: '-50%',
        boxShadow: [
          '0 0 20px rgba(147, 51, 234, 0.2)',
          '0 0 50px rgba(147, 51, 234, 0.5)',
          '0 0 20px rgba(147, 51, 234, 0.2)',
        ],
      }}
      exit={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// =============================================================================
// COMPLETION FLASH EFFECT
// =============================================================================

interface CompletionFlashProps {
  size: number;
  onComplete?: () => void;
}

function CompletionFlash({ size, onComplete }: CompletionFlashProps) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size * 1.5,
        height: size * 1.5,
        backgroundColor: 'rgba(147, 51, 234, 0.3)',
        left: '50%',
        top: '50%',
      }}
      initial={{ opacity: 0, scale: 0.5, x: '-50%', y: '-50%' }}
      animate={{
        opacity: [0, 0.8, 0],
        scale: [0.8, 1.3, 1.5],
        x: '-50%',
        y: '-50%',
      }}
      transition={{
        duration: 0.6,
        ease: 'easeOut',
      }}
      onAnimationComplete={onComplete}
    />
  );
}

// =============================================================================
// SIZE MAPPING
// =============================================================================

const SIZE_PIXELS: Record<RingSize, number> = {
  xs: 24,
  sm: 40,
  md: 64,
  lg: 96,
  xl: 128,
  hero: 192,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LoadingRing({
  isLoading,
  progress,
  size = 'md',
  pulseFrequency = 1,
  flashOnComplete = true,
  className,
  onComplete,
}: LoadingRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const sizePixels = SIZE_PIXELS[size];

  // Track completion for flash effect
  const [showFlash, setShowFlash] = useState(false);
  const wasLoadingRef = useRef(false);

  // Handle completion flash
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && flashOnComplete) {
      setShowFlash(true);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, flashOnComplete]);

  const handleFlashComplete = useCallback(() => {
    setShowFlash(false);
    onComplete?.();
  }, [onComplete]);

  // Determine ring state
  const ringState = useMemo(() => {
    if (isLoading) return 'processing';
    return 'active';
  }, [isLoading]);

  // Check if progress is determinate
  const isDeterminate = progress !== undefined;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {/* Indeterminate pulse glow (behind ring) */}
      <AnimatePresence>
        {isLoading && !isDeterminate && (
          <IndeterminatePulse
            size={sizePixels}
            frequency={pulseFrequency}
            reducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* Main Opta Ring */}
      <OptaRing
        state={ringState}
        size={size}
        breathe={!isLoading}
      />

      {/* Progress ring overlay (determinate) */}
      <AnimatePresence>
        {isLoading && isDeterminate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProgressRingOverlay
              progress={progress}
              size={sizePixels}
              reducedMotion={prefersReducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion flash */}
      <AnimatePresence>
        {showFlash && (
          <CompletionFlash
            size={sizePixels}
            onComplete={handleFlashComplete}
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
 * Small loading ring for inline use
 */
export function SmallLoadingRing(
  props: Omit<LoadingRingProps, 'size'>
) {
  return <LoadingRing size="sm" {...props} />;
}

/**
 * Large loading ring for page transitions
 */
export function LargeLoadingRing(
  props: Omit<LoadingRingProps, 'size'>
) {
  return <LoadingRing size="lg" {...props} />;
}

/**
 * Hero loading ring for splash screens
 */
export function HeroLoadingRing(
  props: Omit<LoadingRingProps, 'size'>
) {
  return <LoadingRing size="hero" {...props} />;
}

/**
 * Fast pulse loading ring (2Hz)
 */
export function FastLoadingRing(
  props: Omit<LoadingRingProps, 'pulseFrequency'>
) {
  return <LoadingRing pulseFrequency={2} {...props} />;
}

export default LoadingRing;
