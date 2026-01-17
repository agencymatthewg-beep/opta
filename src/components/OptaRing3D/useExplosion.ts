import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useExplosion - Hook for managing ring explosion state
 *
 * Provides:
 * - Explosion trigger function
 * - Active state
 * - Progress tracking
 * - Auto-cleanup after animation
 *
 * @see Phase 27: Ring Explosion Effect
 */

export interface ExplosionConfig {
  /** Duration of the explosion in ms (default: 800) */
  duration?: number;
  /** Particle count (default: 250) */
  particleCount?: number;
  /** Enable bloom effect (default: true) */
  enableBloom?: boolean;
  /** Bloom intensity at peak (default: 2) */
  bloomIntensity?: number;
  /** Enable camera shake (default: true) */
  enableCameraShake?: boolean;
  /** Camera shake duration in ms (default: 80) */
  cameraShakeDuration?: number;
  /** Camera shake intensity (default: 0.02) */
  cameraShakeIntensity?: number;
  /** Shockwave duration in ms (default: 600) */
  shockwaveDuration?: number;
  /** Callback when explosion completes */
  onComplete?: () => void;
  /** Callback when explosion starts */
  onStart?: () => void;
}

export interface ExplosionState {
  /** Whether the explosion is currently active */
  isExploding: boolean;
  /** Progress of the explosion (0-1) */
  progress: number;
  /** Config for the current explosion */
  config: Required<ExplosionConfig>;
}

export interface UseExplosionReturn extends ExplosionState {
  /** Trigger an explosion */
  explode: (overrideConfig?: Partial<ExplosionConfig>) => void;
  /** Cancel the current explosion */
  cancel: () => void;
  /** Reset state (useful for re-mounting) */
  reset: () => void;
}

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
};

export function useExplosion(defaultConfig?: Partial<ExplosionConfig>): UseExplosionReturn {
  const [isExploding, setIsExploding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [config, setConfig] = useState<Required<ExplosionConfig>>({
    ...DEFAULT_CONFIG,
    ...defaultConfig,
  });

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isExplodingRef = useRef(false);

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

/**
 * Pre-configured explosion presets
 */
export const explosionPresets = {
  /** Standard explosion - balanced settings */
  standard: {
    duration: 800,
    particleCount: 250,
    bloomIntensity: 2,
    cameraShakeDuration: 80,
  } as Partial<ExplosionConfig>,

  /** Subtle explosion - less intense */
  subtle: {
    duration: 600,
    particleCount: 150,
    bloomIntensity: 1,
    cameraShakeDuration: 50,
    cameraShakeIntensity: 0.01,
  } as Partial<ExplosionConfig>,

  /** Intense explosion - maximum drama */
  intense: {
    duration: 1000,
    particleCount: 300,
    bloomIntensity: 3,
    cameraShakeDuration: 100,
    cameraShakeIntensity: 0.03,
  } as Partial<ExplosionConfig>,

  /** Quick explosion - fast feedback */
  quick: {
    duration: 400,
    particleCount: 200,
    bloomIntensity: 1.5,
    shockwaveDuration: 300,
    cameraShakeDuration: 40,
  } as Partial<ExplosionConfig>,

  /** No shake - explosion without camera movement */
  noShake: {
    duration: 800,
    particleCount: 250,
    enableCameraShake: false,
  } as Partial<ExplosionConfig>,
};

export default useExplosion;
