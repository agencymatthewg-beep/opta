import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * ExplosionEffects - Bloom post-processing and camera shake
 *
 * Combines:
 * - Bloom effect that intensifies during explosion (0 -> 2 -> 0)
 * - Subtle camera shake micro-animation (50-100ms)
 *
 * @see Phase 27-04, 27-05: Ring Explosion Effect
 */

interface ExplosionEffectsProps {
  /** Whether the explosion is active */
  active: boolean;
  /** Duration of the explosion in ms */
  duration?: number;
  /** Maximum bloom intensity at peak */
  maxBloomIntensity?: number;
  /** Enable camera shake */
  enableCameraShake?: boolean;
  /** Camera shake intensity (max offset in units) */
  cameraShakeIntensity?: number;
  /** Camera shake duration in ms */
  cameraShakeDuration?: number;
}

export function ExplosionEffects({
  active,
  duration = 800,
  maxBloomIntensity = 2,
  enableCameraShake = true,
  cameraShakeIntensity = 0.02,
  cameraShakeDuration = 80,
}: ExplosionEffectsProps) {
  const { camera } = useThree();
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
    // Peak at 20% of duration, then decay
    if (overallProgress < 0.2) {
      // Ramp up to peak
      bloomIntensityRef.current = (overallProgress / 0.2) * maxBloomIntensity;
    } else {
      // Decay from peak
      const decayProgress = (overallProgress - 0.2) / 0.8;
      bloomIntensityRef.current = maxBloomIntensity * (1 - Math.pow(decayProgress, 2));
    }

    // Camera shake only during initial burst (first 50-100ms)
    if (enableCameraShake && elapsed < cameraShakeDuration && !shakeCompleteRef.current) {
      const shakeProgress = elapsed / cameraShakeDuration;

      // Damped oscillation
      const dampingFactor = 1 - shakeProgress;
      const frequency = 60; // High frequency shake
      const oscillation = Math.sin(elapsed * frequency / 1000 * Math.PI * 2);

      // Apply shake offset
      const offsetX = oscillation * cameraShakeIntensity * dampingFactor;
      const offsetY = Math.cos(elapsed * frequency * 1.3 / 1000 * Math.PI * 2) * cameraShakeIntensity * dampingFactor;

      camera.position.x = originalCameraPosition.current.x + offsetX;
      camera.position.y = originalCameraPosition.current.y + offsetY;
    } else if (!shakeCompleteRef.current && elapsed >= cameraShakeDuration) {
      // Restore original position after shake completes
      shakeCompleteRef.current = true;
      camera.position.copy(originalCameraPosition.current);
    }
  });

  // Dynamic bloom intensity based on animation progress
  const getCurrentBloomIntensity = () => {
    return active ? bloomIntensityRef.current : 0;
  };

  return (
    <EffectComposer>
      <Bloom
        intensity={getCurrentBloomIntensity()}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.5}
        mipmapBlur
      />
    </EffectComposer>
  );
}

/**
 * AnimatedBloom - Standalone bloom component with animated intensity
 *
 * This is a simpler version that just handles bloom animation
 * without the full EffectComposer (for integration into existing composers)
 */
interface AnimatedBloomProps {
  /** Current explosion progress (0-1) */
  progress: number;
  /** Maximum bloom intensity */
  maxIntensity?: number;
}

export function AnimatedBloom({
  progress,
  maxIntensity = 2,
}: AnimatedBloomProps) {
  // Calculate intensity based on progress
  let intensity = 0;
  if (progress < 0.2) {
    // Ramp up to peak
    intensity = (progress / 0.2) * maxIntensity;
  } else if (progress < 1) {
    // Decay from peak
    const decayProgress = (progress - 0.2) / 0.8;
    intensity = maxIntensity * (1 - Math.pow(decayProgress, 2));
  }

  return (
    <Bloom
      intensity={intensity}
      luminanceThreshold={0.8}
      luminanceSmoothing={0.5}
      mipmapBlur
    />
  );
}

/**
 * CameraShake - Standalone camera shake effect
 *
 * For use when you want camera shake without bloom
 */
interface CameraShakeProps {
  /** Whether shake is active */
  active: boolean;
  /** Maximum offset in units */
  intensity?: number;
  /** Duration in ms */
  duration?: number;
  /** Callback when shake completes */
  onComplete?: () => void;
}

export function useCameraShake({
  active,
  intensity = 0.02,
  duration = 80,
  onComplete,
}: CameraShakeProps) {
  const { camera } = useThree();
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

    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = (state.clock.elapsedTime - startTimeRef.current) * 1000;

    if (elapsed < duration) {
      const progress = elapsed / duration;
      const dampingFactor = 1 - progress;
      const frequency = 60;
      const oscillation = Math.sin(elapsed * frequency / 1000 * Math.PI * 2);

      const offsetX = oscillation * intensity * dampingFactor;
      const offsetY = Math.cos(elapsed * frequency * 1.3 / 1000 * Math.PI * 2) * intensity * dampingFactor;

      camera.position.x = originalPosition.current.x + offsetX;
      camera.position.y = originalPosition.current.y + offsetY;
    } else if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      camera.position.copy(originalPosition.current);
      onComplete?.();
    }
  });
}

export default ExplosionEffects;
