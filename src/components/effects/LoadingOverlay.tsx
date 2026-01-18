/**
 * LoadingOverlay Component
 *
 * Premium loading overlay combining all Phase 34 loading effects.
 * Provides a unified interface for different loading states and styles.
 *
 * Features:
 * - Chromatic aberration effect
 * - TRON-style scan lines
 * - Holographic shimmer
 * - Matrix-style data stream
 * - Ring-synchronized pulsing
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { OptaRing } from '@/components/OptaRing';

import { ChromaticLoading } from './ChromaticLoading';
import { ScanLines } from './ScanLines';
import { HoloShimmer } from './HoloShimmer';
import { DataStream } from './DataStream';

// =============================================================================
// TYPES
// =============================================================================

export type LoadingPreset =
  | 'default'
  | 'minimal'
  | 'cinematic'
  | 'matrix'
  | 'retro'
  | 'holographic';

export type LoadingSize = 'sm' | 'md' | 'lg' | 'fullscreen';

export interface LoadingOverlayProps {
  /** Whether loading is active */
  isLoading: boolean;
  /** Loading progress (0-100), undefined for indeterminate */
  progress?: number;
  /** Loading message to display */
  message?: string;
  /** Visual preset */
  preset?: LoadingPreset;
  /** Overlay size */
  size?: LoadingSize;
  /** Show Opta Ring */
  showRing?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children to render behind overlay */
  children?: React.ReactNode;
  /** Callback when loading completes */
  onComplete?: () => void;
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

interface PresetConfig {
  chromatic: boolean;
  chromaticIntensity: number;
  scanLines: boolean;
  scanLineOpacity: number;
  holoShimmer: boolean;
  holoOpacity: number;
  dataStream: boolean;
  dataStreamDensity: number;
  dataStreamOpacity: number;
  // Note: Background is handled by glass class, not inline styles
}

const PRESETS: Record<LoadingPreset, PresetConfig> = {
  default: {
    chromatic: true,
    chromaticIntensity: 0.4,
    scanLines: true,
    scanLineOpacity: 0.02,
    holoShimmer: false,
    holoOpacity: 0,
    dataStream: false,
    dataStreamDensity: 0,
    dataStreamOpacity: 0,
  },
  minimal: {
    chromatic: false,
    chromaticIntensity: 0,
    scanLines: false,
    scanLineOpacity: 0,
    holoShimmer: false,
    holoOpacity: 0,
    dataStream: false,
    dataStreamDensity: 0,
    dataStreamOpacity: 0,
  },
  cinematic: {
    chromatic: true,
    chromaticIntensity: 0.6,
    scanLines: true,
    scanLineOpacity: 0.03,
    holoShimmer: false,
    holoOpacity: 0,
    dataStream: true,
    dataStreamDensity: 0.2,
    dataStreamOpacity: 0.4,
  },
  matrix: {
    chromatic: true,
    chromaticIntensity: 0.3,
    scanLines: true,
    scanLineOpacity: 0.025,
    holoShimmer: false,
    holoOpacity: 0,
    dataStream: true,
    dataStreamDensity: 0.4,
    dataStreamOpacity: 0.7,
  },
  retro: {
    chromatic: true,
    chromaticIntensity: 0.5,
    scanLines: true,
    scanLineOpacity: 0.05,
    holoShimmer: false,
    holoOpacity: 0,
    dataStream: false,
    dataStreamDensity: 0,
    dataStreamOpacity: 0,
  },
  holographic: {
    chromatic: false,
    chromaticIntensity: 0,
    scanLines: false,
    scanLineOpacity: 0,
    holoShimmer: true,
    holoOpacity: 0.15,
    dataStream: false,
    dataStreamDensity: 0,
    dataStreamOpacity: 0,
  },
};

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

const SIZE_CLASSES: Record<LoadingSize, string> = {
  sm: 'p-4',
  md: 'p-8',
  lg: 'p-12',
  fullscreen: 'fixed inset-0 z-50',
};

const RING_SIZES: Record<LoadingSize, 'xs' | 'sm' | 'md' | 'lg' | 'xl'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  fullscreen: 'xl',
};

// =============================================================================
// PROGRESS RING COMPONENT
// =============================================================================

interface ProgressRingProps {
  progress: number;
  size: number;
}

function ProgressRing({ progress, size }: ProgressRingProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute -rotate-90"
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }}
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
      {/* Progress ring */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(147, 51, 234)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          filter: 'drop-shadow(0 0 6px rgba(147, 51, 234, 0.5))',
        }}
      />
    </svg>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LoadingOverlay({
  isLoading,
  progress,
  message,
  preset = 'default',
  size = 'fullscreen',
  showRing = true,
  className,
  children,
  onComplete,
}: LoadingOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = PRESETS[preset];

  // Determine ring state based on progress
  const ringState = useMemo(() => {
    if (!isLoading) return 'dormant';
    return 'processing';
  }, [isLoading]);

  // Calculate ring size in pixels for progress ring
  const ringPixelSize = useMemo(() => {
    switch (RING_SIZES[size]) {
      case 'xs': return 24;
      case 'sm': return 40;
      case 'md': return 64;
      case 'lg': return 96;
      case 'xl': return 128;
      default: return 64;
    }
  }, [size]);

  // Handle completion callback
  const handleAnimationComplete = () => {
    if (!isLoading && onComplete) {
      onComplete();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Background content */}
      {children}

      {/* Loading overlay */}
      <AnimatePresence onExitComplete={handleAnimationComplete}>
        {isLoading && (
          <motion.div
            className={cn(
              'flex flex-col items-center justify-center',
              'glass backdrop-blur-xl bg-background/80 border-0',
              SIZE_CLASSES[size],
              size === 'fullscreen' ? '' : 'absolute inset-0 rounded-inherit'
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Data stream background */}
            {config.dataStream && !prefersReducedMotion && (
              <DataStream
                active={isLoading}
                density={config.dataStreamDensity}
                opacity={config.dataStreamOpacity}
                className="absolute inset-0"
              />
            )}

            {/* Scan lines overlay */}
            {config.scanLines && (
              <ScanLines
                active={isLoading}
                opacity={config.scanLineOpacity}
                className="absolute inset-0"
              />
            )}

            {/* Chromatic effect wrapper */}
            <ChromaticLoading
              isLoading={config.chromatic && isLoading}
              intensity={config.chromaticIntensity}
              className="relative z-10 flex flex-col items-center"
            >
              {/* Holographic shimmer wrapper */}
              <HoloShimmer
                isLoading={config.holoShimmer && isLoading}
                opacity={config.holoOpacity}
                className="flex flex-col items-center"
              >
                {/* Opta Ring */}
                {showRing && (
                  <div className="relative">
                    <OptaRing
                      state={ringState}
                      size={RING_SIZES[size]}
                      breathe={false}
                    />

                    {/* Progress ring overlay */}
                    {progress !== undefined && (
                      <ProgressRing
                        progress={progress}
                        size={ringPixelSize + 20}
                      />
                    )}
                  </div>
                )}

                {/* Loading message */}
                {message && (
                  <motion.p
                    className="mt-6 text-sm text-foreground/70 text-center max-w-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    {message}
                  </motion.p>
                )}

                {/* Progress percentage */}
                {progress !== undefined && (
                  <motion.p
                    className="mt-3 text-xs text-foreground/50 font-mono"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    {Math.round(progress)}%
                  </motion.p>
                )}
              </HoloShimmer>
            </ChromaticLoading>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// PRESET COMPONENTS
// =============================================================================

/**
 * Minimal loading overlay
 */
export function MinimalLoadingOverlay(
  props: Omit<LoadingOverlayProps, 'preset'>
) {
  return <LoadingOverlay preset="minimal" {...props} />;
}

/**
 * Cinematic loading overlay (for major transitions)
 */
export function CinematicLoadingOverlay(
  props: Omit<LoadingOverlayProps, 'preset'>
) {
  return <LoadingOverlay preset="cinematic" {...props} />;
}

/**
 * Matrix-style loading overlay
 */
export function MatrixLoadingOverlay(
  props: Omit<LoadingOverlayProps, 'preset'>
) {
  return <LoadingOverlay preset="matrix" {...props} />;
}

/**
 * Retro CRT-style loading overlay
 */
export function RetroLoadingOverlay(
  props: Omit<LoadingOverlayProps, 'preset'>
) {
  return <LoadingOverlay preset="retro" {...props} />;
}

/**
 * Holographic loading overlay
 */
export function HolographicLoadingOverlay(
  props: Omit<LoadingOverlayProps, 'preset'>
) {
  return <LoadingOverlay preset="holographic" {...props} />;
}

// =============================================================================
// COMPACT LOADING INDICATOR
// =============================================================================

export interface CompactLoadingProps {
  /** Whether loading is active */
  isLoading: boolean;
  /** Optional size */
  size?: 'xs' | 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact inline loading indicator using OptaRing
 */
export function CompactLoading({
  isLoading,
  size = 'sm',
  className,
}: CompactLoadingProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className={cn('inline-flex items-center justify-center', className)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <OptaRing state="processing" size={size} breathe={false} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoadingOverlay;
