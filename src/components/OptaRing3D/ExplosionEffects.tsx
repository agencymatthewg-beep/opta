import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * ExplosionEffects - Bloom Post-Processing and Camera Shake
 *
 * Combines visual effects for the ring explosion:
 * - **Bloom**: Intensifies during explosion (0 -> peak -> 0) with luminance threshold
 * - **Camera Shake**: Subtle micro-animation (50-100ms) with damped oscillation
 *
 * ## Timing Coordination
 * - Bloom peaks at 20% of duration, then decays quadratically
 * - Camera shake is brief initial burst only (first 50-100ms)
 * - Both effects work independently but are triggered together
 *
 * ## Performance Notes
 * - Uses @react-three/postprocessing for efficient GPU-based bloom
 * - Camera shake manipulates position directly (no additional passes)
 *
 * @see Phase 27-04, 27-05: Ring Explosion Effect
 * @see RingExplosion for the orchestrator component
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Bloom luminance threshold (only bright pixels bloom) */
const BLOOM_LUMINANCE_THRESHOLD = 0.8;

/** Bloom luminance smoothing factor */
const BLOOM_LUMINANCE_SMOOTHING = 0.5;

/** Bloom peak timing as fraction of total duration */
const BLOOM_PEAK_TIMING = 0.2;

/** Camera shake oscillation frequency in Hz */
const SHAKE_FREQUENCY_HZ = 60;

/** Y-axis shake frequency multiplier (slightly different for variety) */
const SHAKE_Y_FREQUENCY_MULT = 1.3;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ExplosionEffects component.
 */
interface ExplosionEffectsProps {
  /** Whether the explosion effect is currently active */
  active: boolean;

  /**
   * Total duration of the explosion animation in milliseconds.
   * @default 800
   */
  duration?: number;

  /**
   * Peak bloom intensity during explosion.
   * @default 2
   */
  maxBloomIntensity?: number;

  /**
   * Enable camera shake micro-animation.
   * @default true
   */
  enableCameraShake?: boolean;

  /**
   * Camera shake offset intensity in world units.
   * @default 0.02
   */
  cameraShakeIntensity?: number;

  /**
   * Duration of camera shake effect in milliseconds.
   * @default 80
   */
  cameraShakeDuration?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExplosionEffects({
  active,
  duration = 800,
  maxBloomIntensity = 2,
  enableCameraShake = true,
  cameraShakeIntensity = 0.02,
  cameraShakeDuration = 80,
}: ExplosionEffectsProps): React.ReactNode {
  const { camera } = useThree();

  // Animation state refs
  const startTimeRef = useRef<number>(0);
  const bloomIntensityRef = useRef<number>(0);
  const originalCameraPosition = useRef<THREE.Vector3 | null>(null);
  const shakeCompleteRef = useRef<boolean>(false);

  // Store original camera position on mount
  useEffect(() => {
    originalCameraPosition.current = camera.position.clone();

    return () => {
      // Reset camera position on unmount
      if (originalCameraPosition.current) {
        camera.position.copy(originalCameraPosition.current);
      }
    };
  }, [camera]);

  // Reset on activation
  useEffect(() => {
    if (active) {
      startTimeRef.current = 0;
      shakeCompleteRef.current = false;
      bloomIntensityRef.current = 0;

      // Store current camera position as original
      originalCameraPosition.current = camera.position.clone();
    } else {
      // Reset camera when deactivated
      if (originalCameraPosition.current) {
        camera.position.copy(originalCameraPosition.current);
      }
    }
  }, [active, camera]);

  // Animation frame for camera shake
  useFrame((state) => {
    if (!active || !originalCameraPosition.current) return;

    // Track elapsed time
    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = (state.clock.elapsedTime - startTimeRef.current) * 1000;
    const overallProgress = Math.min(elapsed / duration, 1);

    // Calculate bloom intensity (ramp up then down)
    // Peak at BLOOM_PEAK_TIMING of duration, then decay quadratically
    if (overallProgress < BLOOM_PEAK_TIMING) {
      // Ramp up to peak
      bloomIntensityRef.current = (overallProgress / BLOOM_PEAK_TIMING) * maxBloomIntensity;
    } else {
      // Decay from peak with quadratic falloff
      const decayProgress = (overallProgress - BLOOM_PEAK_TIMING) / (1 - BLOOM_PEAK_TIMING);
      bloomIntensityRef.current = maxBloomIntensity * (1 - Math.pow(decayProgress, 2));
    }

    // Camera shake only during initial burst (first 50-100ms)
    if (enableCameraShake && elapsed < cameraShakeDuration && !shakeCompleteRef.current) {
      const shakeProgress = elapsed / cameraShakeDuration;

      // Damped oscillation with linear decay
      const dampingFactor = 1 - shakeProgress;
      const oscillationX = Math.sin(elapsed * SHAKE_FREQUENCY_HZ / 1000 * Math.PI * 2);
      const oscillationY = Math.cos(elapsed * SHAKE_FREQUENCY_HZ * SHAKE_Y_FREQUENCY_MULT / 1000 * Math.PI * 2);

      // Apply shake offset with damping
      const offsetX = oscillationX * cameraShakeIntensity * dampingFactor;
      const offsetY = oscillationY * cameraShakeIntensity * dampingFactor;

      camera.position.x = originalCameraPosition.current.x + offsetX;
      camera.position.y = originalCameraPosition.current.y + offsetY;
    } else if (!shakeCompleteRef.current && elapsed >= cameraShakeDuration) {
      // Restore original position after shake completes
      shakeCompleteRef.current = true;
      camera.position.copy(originalCameraPosition.current);
    }
  });

  /**
   * Get current bloom intensity based on animation state.
   * Returns 0 when inactive to disable bloom entirely.
   */
  const getCurrentBloomIntensity = (): number => {
    return active ? bloomIntensityRef.current : 0;
  };

  return (
    <EffectComposer>
      <Bloom
        intensity={getCurrentBloomIntensity()}
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
        mipmapBlur
      />
    </EffectComposer>
  );
}

// =============================================================================
// STANDALONE COMPONENTS
// =============================================================================

/**
 * AnimatedBloom - Standalone Bloom with Progress-Based Intensity
 *
 * A simpler bloom component that accepts progress directly, useful for
 * integration into existing EffectComposer setups where you manage
 * the progress externally.
 *
 * @example
 * ```tsx
 * <EffectComposer>
 *   <AnimatedBloom progress={explosionProgress} maxIntensity={3} />
 *   <OtherEffect />
 * </EffectComposer>
 * ```
 */
interface AnimatedBloomProps {
  /**
   * Current animation progress from 0 (start) to 1 (complete).
   */
  progress: number;

  /**
   * Peak bloom intensity during explosion.
   * @default 2
   */
  maxIntensity?: number;
}

export function AnimatedBloom({
  progress,
  maxIntensity = 2,
}: AnimatedBloomProps): React.ReactNode {
  // Calculate intensity based on progress using same curve as ExplosionEffects
  let intensity = 0;
  if (progress < BLOOM_PEAK_TIMING) {
    // Ramp up to peak
    intensity = (progress / BLOOM_PEAK_TIMING) * maxIntensity;
  } else if (progress < 1) {
    // Decay from peak with quadratic falloff
    const decayProgress = (progress - BLOOM_PEAK_TIMING) / (1 - BLOOM_PEAK_TIMING);
    intensity = maxIntensity * (1 - Math.pow(decayProgress, 2));
  }

  return (
    <Bloom
      intensity={intensity}
      luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
      luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
      mipmapBlur
    />
  );
}

/**
 * useCameraShake - Standalone Camera Shake Hook
 *
 * A reusable hook for camera shake effects without bloom.
 * Uses damped oscillation with configurable intensity and duration.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useCameraShake({
 *     active: isShaking,
 *     intensity: 0.03,
 *     duration: 100,
 *     onComplete: () => setIsShaking(false),
 *   });
 *   return <mesh>...</mesh>;
 * }
 * ```
 */
interface UseCameraShakeOptions {
  /** Whether shake is currently active */
  active: boolean;

  /**
   * Maximum offset in world units.
   * @default 0.02
   */
  intensity?: number;

  /**
   * Duration in milliseconds.
   * @default 80
   */
  duration?: number;

  /** Callback fired when shake animation completes */
  onComplete?: () => void;
}

export function useCameraShake({
  active,
  intensity = 0.02,
  duration = 80,
  onComplete,
}: UseCameraShakeOptions): void {
  const { camera } = useThree();

  // Animation state refs
  const startTimeRef = useRef<number>(0);
  const originalPosition = useRef<THREE.Vector3 | null>(null);
  const hasCompletedRef = useRef<boolean>(false);

  // Reset on activation
  useEffect(() => {
    if (active) {
      startTimeRef.current = 0;
      hasCompletedRef.current = false;
      originalPosition.current = camera.position.clone();
    }
  }, [active, camera]);

  useFrame((state) => {
    if (!active || !originalPosition.current) return;

    // Initialize start time on first frame
    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = (state.clock.elapsedTime - startTimeRef.current) * 1000;

    if (elapsed < duration) {
      const progress = elapsed / duration;
      const dampingFactor = 1 - progress;

      // Calculate oscillations using shared constants
      const oscillationX = Math.sin(elapsed * SHAKE_FREQUENCY_HZ / 1000 * Math.PI * 2);
      const oscillationY = Math.cos(elapsed * SHAKE_FREQUENCY_HZ * SHAKE_Y_FREQUENCY_MULT / 1000 * Math.PI * 2);

      // Apply damped offset
      const offsetX = oscillationX * intensity * dampingFactor;
      const offsetY = oscillationY * intensity * dampingFactor;

      camera.position.x = originalPosition.current.x + offsetX;
      camera.position.y = originalPosition.current.y + offsetY;
    } else if (!hasCompletedRef.current) {
      // Restore original position and fire callback
      hasCompletedRef.current = true;
      camera.position.copy(originalPosition.current);
      onComplete?.();
    }
  });
}

export default ExplosionEffects;
