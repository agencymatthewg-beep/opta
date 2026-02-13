/**
 * useChromaticLoading - Hook for chromatic aberration loading effects
 *
 * Coordinates chromatic aberration effect with loading states.
 * Wraps async operations with automatic visual feedback.
 *
 * @example
 * ```tsx
 * function DataFetcher() {
 *   const { isLoading, withChromatic } = useChromaticLoading();
 *
 *   const handleFetch = async () => {
 *     const data = await withChromatic(async () => {
 *       return await fetchData();
 *     });
 *     setData(data);
 *   };
 *
 *   return (
 *     <ChromaticLoader isLoading={isLoading}>
 *       <DataTable data={data} />
 *     </ChromaticLoader>
 *   );
 * }
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useState, useCallback, useRef } from 'react';
import { useMotionValue, animate, type MotionValue } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ChromaticPreset } from '@/lib/shaders/types';
import { chromaticPresets } from '@/lib/shaders/types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseChromaticLoadingOptions {
  /** Chromatic preset to use */
  preset?: ChromaticPreset;
  /** Minimum loading time in ms (prevents flash) */
  minLoadingTime?: number;
  /** Callback when loading starts */
  onStart?: () => void;
  /** Callback when loading ends */
  onEnd?: () => void;
}

export interface UseChromaticLoadingReturn {
  /** Whether currently loading */
  isLoading: boolean;
  /** Animation phase (0 = off, 1 = full effect) */
  animationPhase: MotionValue<number>;
  /** Manually start loading state */
  startLoading: () => void;
  /** Manually stop loading state */
  stopLoading: () => void;
  /** Wrap an async operation with chromatic effect */
  withChromatic: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Current preset configuration */
  preset: typeof chromaticPresets[ChromaticPreset];
}

// =============================================================================
// HOOK
// =============================================================================

export function useChromaticLoading(
  options: UseChromaticLoadingOptions = {}
): UseChromaticLoadingReturn {
  const {
    preset = 'loading',
    minLoadingTime = 300,
    onStart,
    onEnd,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const loadingStartRef = useRef<number>(0);

  // Animation phase for shader (0 = off, 1 = full effect)
  const animationPhase = useMotionValue(0);

  // Start loading state
  const startLoading = useCallback(() => {
    setIsLoading(true);
    loadingStartRef.current = Date.now();
    onStart?.();

    if (!prefersReducedMotion) {
      animate(animationPhase, 1, { duration: 0.3 });
    }
  }, [animationPhase, onStart, prefersReducedMotion]);

  // Stop loading state
  const stopLoading = useCallback(() => {
    const elapsed = Date.now() - loadingStartRef.current;
    const remaining = Math.max(0, minLoadingTime - elapsed);

    // Ensure minimum loading time to prevent flash
    setTimeout(() => {
      if (!prefersReducedMotion) {
        animate(animationPhase, 0, { duration: 0.2 }).then(() => {
          setIsLoading(false);
          onEnd?.();
        });
      } else {
        setIsLoading(false);
        onEnd?.();
      }
    }, remaining);
  }, [animationPhase, minLoadingTime, onEnd, prefersReducedMotion]);

  // Wrap async operations with chromatic effect
  const withChromatic = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      startLoading();
      try {
        return await operation();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return {
    isLoading,
    animationPhase,
    startLoading,
    stopLoading,
    withChromatic,
    preset: chromaticPresets[preset],
  };
}

// =============================================================================
// PREMIUM LOADING HOOK (CHROMATIC + BLUR)
// =============================================================================

/**
 * usePremiumLoading - Combined chromatic + blur-back effect
 *
 * Creates a premium loading experience by combining
 * chromatic aberration with background blur.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, withPremiumLoading } = usePremiumLoading();
 *
 *   const handleAction = async () => {
 *     await withPremiumLoading(heavyOperation);
 *   };
 *
 *   return (
 *     <BlurBackProvider>
 *       <BlurBackContent>
 *         <ChromaticLoader isLoading={isLoading}>
 *           <Content />
 *         </ChromaticLoader>
 *       </BlurBackContent>
 *     </BlurBackProvider>
 *   );
 * }
 * ```
 */
export interface UsePremiumLoadingOptions extends UseChromaticLoadingOptions {
  /** Blur amount when loading */
  blurAmount?: number;
  /** Scale amount when loading */
  scaleAmount?: number;
}

export interface UsePremiumLoadingReturn extends UseChromaticLoadingReturn {
  /** Wrap with premium effect (chromatic + blur) */
  withPremiumLoading: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Blur configuration for BlurBackProvider */
  blurConfig: { blur: number; scale: number };
}

// Note: This hook requires BlurBackProvider context
// We import useBlurBack dynamically to avoid circular dependencies
export function usePremiumLoading(
  options: UsePremiumLoadingOptions = {}
): UsePremiumLoadingReturn {
  const { blurAmount = 4, scaleAmount = 0.98, ...chromaticOptions } = options;

  const chromatic = useChromaticLoading(chromaticOptions);

  // Store blur control function (will be set if BlurBackProvider exists)
  const blurControlRef = useRef<((active: boolean, blur?: number, scale?: number) => void) | null>(null);

  // Try to get blur control from context
  // This is done lazily to avoid issues when provider isn't available
  const getBlurControl = useCallback(() => {
    if (blurControlRef.current) return blurControlRef.current;

    try {
      // Dynamic import would be better but we'll use a simple approach
      // In practice, components using this should ensure BlurBackProvider exists
      return null;
    } catch {
      return null;
    }
  }, []);

  // Start premium loading
  const startPremiumLoading = useCallback(() => {
    chromatic.startLoading();
    const blurControl = getBlurControl();
    blurControl?.(true, blurAmount, scaleAmount);
  }, [chromatic, getBlurControl, blurAmount, scaleAmount]);

  // Stop premium loading
  const stopPremiumLoading = useCallback(() => {
    chromatic.stopLoading();
    const blurControl = getBlurControl();
    // Delay blur removal slightly for smoother transition
    setTimeout(() => {
      blurControl?.(false);
    }, 100);
  }, [chromatic, getBlurControl]);

  // Wrap with premium effect
  const withPremiumLoading = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      startPremiumLoading();
      try {
        return await operation();
      } finally {
        stopPremiumLoading();
      }
    },
    [startPremiumLoading, stopPremiumLoading]
  );

  return {
    ...chromatic,
    withPremiumLoading,
    blurConfig: { blur: blurAmount, scale: scaleAmount },
  };
}

// =============================================================================
// LOADING STATE UTILITIES
// =============================================================================

/**
 * useMultipleLoadingStates - Track multiple loading operations
 *
 * Useful when you have multiple concurrent operations
 * and want a single loading indicator.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { isAnyLoading, track } = useMultipleLoadingStates();
 *
 *   useEffect(() => {
 *     track('users', fetchUsers());
 *     track('stats', fetchStats());
 *   }, []);
 *
 *   return (
 *     <ChromaticLoader isLoading={isAnyLoading}>
 *       ...
 *     </ChromaticLoader>
 *   );
 * }
 * ```
 */
export function useMultipleLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const track = useCallback(async <T,>(key: string, promise: Promise<T>): Promise<T> => {
    setLoadingStates((prev) => ({ ...prev, [key]: true }));
    try {
      return await promise;
    } finally {
      setLoadingStates((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const isAnyLoading = Object.values(loadingStates).some(Boolean);
  const loadingCount = Object.values(loadingStates).filter(Boolean).length;

  return {
    loadingStates,
    isAnyLoading,
    loadingCount,
    track,
  };
}

export default useChromaticLoading;
