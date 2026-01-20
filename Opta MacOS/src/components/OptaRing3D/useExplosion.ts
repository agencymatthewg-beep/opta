import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useExplosion - State Management Hook for Ring Explosion Effect
 *
 * Provides complete explosion lifecycle management including:
 * - Trigger function with optional config overrides
 * - Active state for conditional rendering
 * - Real-time progress tracking (0-1)
 * - Auto-cleanup after animation completion
 * - Cancel/reset functions for interruption handling
 *
 * ## Usage Example
 * ```tsx
 * const { isExploding, explode, progress, config } = useExplosion({
 *   duration: 800,
 *   particleCount: 250,
 * });
 *
 * // Trigger explosion
 * <button onClick={() => explode()}>Celebrate!</button>
 *
 * // Pass state to visual components
 * <RingExplosion active={isExploding} config={config} />
 * ```
 *
 * @see Phase 27: Ring Explosion Effect
 * @see RingExplosion for the visual component
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration options for the explosion effect.
 * All properties are optional with sensible defaults.
 */
export interface ExplosionConfig {
  /**
   * Total duration of the explosion animation in milliseconds.
   * @default 800
   */
  duration?: number;

  /**
   * Number of particles in the burst effect.
   * @default 250
   */
  particleCount?: number;

  /**
   * Enable post-processing bloom effect for bright glow.
   * @default true
   */
  enableBloom?: boolean;

  /**
   * Peak bloom intensity multiplier during explosion.
   * @default 2
   */
  bloomIntensity?: number;

  /**
   * Enable camera shake micro-animation on explosion.
   * @default true
   */
  enableCameraShake?: boolean;

  /**
   * Duration of camera shake effect in milliseconds.
   * @default 80
   */
  cameraShakeDuration?: number;

  /**
   * Camera shake offset intensity in world units.
   * @default 0.02
   */
  cameraShakeIntensity?: number;

  /**
   * Duration of the shockwave expansion in milliseconds.
   * @default 600
   */
  shockwaveDuration?: number;

  /** Callback fired when explosion animation completes */
  onComplete?: () => void;

  /** Callback fired when explosion is triggered */
  onStart?: () => void;
}

/**
 * Current state of the explosion animation.
 */
export interface ExplosionState {
  /** Whether the explosion is currently animating */
  isExploding: boolean;

  /** Animation progress from 0 (start) to 1 (complete) */
  progress: number;

  /** Active configuration with all defaults resolved */
  config: Required<ExplosionConfig>;
}

/**
 * Return type of the useExplosion hook.
 */
export interface UseExplosionReturn extends ExplosionState {
  /**
   * Trigger an explosion with optional config overrides.
   * @param overrideConfig - Partial config to merge with defaults
   */
  explode: (overrideConfig?: Partial<ExplosionConfig>) => void;

  /** Cancel the current explosion and reset state */
  cancel: () => void;

  /** Reset hook state to initial values */
  reset: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default explosion configuration values */
const DEFAULT_CONFIG: Required<ExplosionConfig> = {
  duration: 800,
  particleCount: 250,
  enableBloom: true,
  bloomIntensity: 2,
  enableCameraShake: true,
  cameraShakeDuration: 80,
  cameraShakeIntensity: 0.02,
  shockwaveDuration: 600,
  onComplete: () => {},
  onStart: () => {},
} as const;

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing explosion animation state and lifecycle.
 *
 * @param defaultConfig - Optional base configuration merged with defaults
 * @returns Explosion state and control functions
 */
export function useExplosion(defaultConfig?: Partial<ExplosionConfig>): UseExplosionReturn {
  // Animation state
  const [isExploding, setIsExploding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [config, setConfig] = useState<Required<ExplosionConfig>>({
    ...DEFAULT_CONFIG,
    ...defaultConfig,
  });

  // Refs for animation frame management
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isExplodingRef = useRef(false); // Ref for sync access in RAF callback

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Animation loop
  const updateProgress = useCallback(() => {
    if (!isExplodingRef.current || startTimeRef.current === null) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min(elapsed / config.duration, 1);

    setProgress(newProgress);

    if (newProgress >= 1) {
      // Explosion complete
      setIsExploding(false);
      isExplodingRef.current = false;
      setProgress(0);
      config.onComplete();
    } else {
      // Continue animation
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [config]);

  // Trigger explosion
  const explode = useCallback((overrideConfig?: Partial<ExplosionConfig>) => {
    // Merge configs
    const mergedConfig = {
      ...config,
      ...overrideConfig,
    };
    setConfig(mergedConfig);

    // Start explosion
    setIsExploding(true);
    isExplodingRef.current = true;
    setProgress(0);
    startTimeRef.current = Date.now();

    mergedConfig.onStart();

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [config, updateProgress]);

  // Cancel explosion
  const cancel = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsExploding(false);
    isExplodingRef.current = false;
    setProgress(0);
    startTimeRef.current = null;
  }, []);

  // Reset state
  const reset = useCallback(() => {
    cancel();
    setConfig({ ...DEFAULT_CONFIG, ...defaultConfig });
  }, [cancel, defaultConfig]);

  return {
    isExploding,
    progress,
    config,
    explode,
    cancel,
    reset,
  };
}

// =============================================================================
// PRESETS
// =============================================================================

/**
 * Pre-configured explosion presets for common use cases.
 *
 * @example
 * ```tsx
 * const { explode } = useExplosion(explosionPresets.intense);
 * // Or override at trigger time:
 * explode(explosionPresets.subtle);
 * ```
 */
export const explosionPresets = {
  /** Standard explosion - balanced for general use */
  standard: {
    duration: 800,
    particleCount: 250,
    bloomIntensity: 2,
    cameraShakeDuration: 80,
  } satisfies Partial<ExplosionConfig>,

  /** Subtle explosion - reduced intensity for minor celebrations */
  subtle: {
    duration: 600,
    particleCount: 150,
    bloomIntensity: 1,
    cameraShakeDuration: 50,
    cameraShakeIntensity: 0.01,
  } satisfies Partial<ExplosionConfig>,

  /** Intense explosion - maximum visual impact for major events */
  intense: {
    duration: 1000,
    particleCount: 300,
    bloomIntensity: 3,
    cameraShakeDuration: 100,
    cameraShakeIntensity: 0.03,
  } satisfies Partial<ExplosionConfig>,

  /** Quick explosion - fast feedback for snappy interactions */
  quick: {
    duration: 400,
    particleCount: 200,
    bloomIntensity: 1.5,
    shockwaveDuration: 300,
    cameraShakeDuration: 40,
  } satisfies Partial<ExplosionConfig>,

  /** No shake - explosion without camera movement (accessibility) */
  noShake: {
    duration: 800,
    particleCount: 250,
    enableCameraShake: false,
  } satisfies Partial<ExplosionConfig>,
} as const;

export default useExplosion;
