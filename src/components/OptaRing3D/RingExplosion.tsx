import { ExplosionParticles } from './ExplosionParticles';
import { Shockwave } from './Shockwave';
import { ExplosionEffects } from './ExplosionEffects';
import type { ExplosionConfig } from './useExplosion';

/**
 * RingExplosion - Combined explosion effect component
 *
 * Orchestrates all explosion sub-components:
 * - Particle emitter (200+ particles)
 * - Shockwave ring expansion
 * - Bloom post-processing
 * - Camera shake
 *
 * Usage:
 * ```tsx
 * const { isExploding, explode, config } = useExplosion();
 *
 * <RingExplosion
 *   active={isExploding}
 *   config={config}
 *   onComplete={() => console.log('Explosion complete')}
 * />
 *
 * <button onClick={explode}>Explode!</button>
 * ```
 *
 * @see Phase 27: Ring Explosion Effect
 */

interface RingExplosionProps {
  /** Whether the explosion is active */
  active: boolean;
  /** Explosion configuration */
  config?: Partial<ExplosionConfig>;
  /** Ring radius for positioning effects */
  ringRadius?: number;
  /** Callback when all effects complete */
  onComplete?: () => void;
}

// Default config values
const DEFAULT_DURATION = 800;
const DEFAULT_PARTICLE_COUNT = 250;
const DEFAULT_BLOOM_INTENSITY = 2;
const DEFAULT_SHOCKWAVE_DURATION = 600;
const DEFAULT_CAMERA_SHAKE_DURATION = 80;
const DEFAULT_CAMERA_SHAKE_INTENSITY = 0.02;

export function RingExplosion({
  active,
  config = {},
  ringRadius = 1,
  onComplete,
}: RingExplosionProps) {
  // Extract config values with defaults
  const {
    duration = DEFAULT_DURATION,
    particleCount = DEFAULT_PARTICLE_COUNT,
    enableBloom = true,
    bloomIntensity = DEFAULT_BLOOM_INTENSITY,
    enableCameraShake = true,
    cameraShakeDuration = DEFAULT_CAMERA_SHAKE_DURATION,
    cameraShakeIntensity = DEFAULT_CAMERA_SHAKE_INTENSITY,
    shockwaveDuration = DEFAULT_SHOCKWAVE_DURATION,
  } = config;

  // Track completion of sub-effects
  // The main explosion is considered complete when particles finish
  // (they have the longest duration)

  return (
    <>
      {/* Particle system - main visual effect */}
      <ExplosionParticles
        active={active}
        particleCount={particleCount}
        ringRadius={ringRadius}
        duration={duration}
        onComplete={onComplete}
      />

      {/* Shockwave ring - expanding ring geometry */}
      <Shockwave
        active={active}
        startRadius={ringRadius}
        endRadius={ringRadius * 3}
        duration={shockwaveDuration}
      />

      {/* Post-processing effects (bloom + camera shake) */}
      {(enableBloom || enableCameraShake) && (
        <ExplosionEffects
          active={active}
          duration={duration}
          maxBloomIntensity={enableBloom ? bloomIntensity : 0}
          enableCameraShake={enableCameraShake}
          cameraShakeIntensity={cameraShakeIntensity}
          cameraShakeDuration={cameraShakeDuration}
        />
      )}
    </>
  );
}

export default RingExplosion;
