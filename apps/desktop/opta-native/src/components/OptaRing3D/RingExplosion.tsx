import { ExplosionParticles } from './ExplosionParticles';
import { Shockwave } from './Shockwave';
import { ExplosionEffects } from './ExplosionEffects';
import type { ExplosionConfig } from './useExplosion';

/**
 * RingExplosion - Orchestrator Component for Explosion Visual Effects
 *
 * Combines and coordinates all explosion sub-components into a unified effect:
 * - **ExplosionParticles**: 200-300 particles radiating from ring
 * - **Shockwave**: Expanding ring geometry
 * - **ExplosionEffects**: Post-processing bloom and camera shake
 *
 * ## Usage
 * ```tsx
 * import { RingExplosion, useExplosion } from '@/components/OptaRing3D';
 *
 * const { isExploding, explode, config } = useExplosion();
 *
 * // In Three.js scene:
 * <RingExplosion
 *   active={isExploding}
 *   config={config}
 *   onComplete={() => console.log('Explosion complete')}
 * />
 *
 * // Trigger:
 * <button onClick={explode}>Celebrate!</button>
 * ```
 *
 * ## Component Coordination
 * - Particles have longest duration (main timing driver)
 * - Shockwave starts simultaneously, completes faster
 * - Bloom ramps up quickly, fades over full duration
 * - Camera shake is brief initial burst only
 *
 * @see Phase 27: Ring Explosion Effect
 * @see useExplosion for state management
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the RingExplosion orchestrator component.
 */
interface RingExplosionProps {
  /** Whether the explosion effect is currently active */
  active: boolean;

  /**
   * Explosion configuration overrides.
   * Merged with defaults for unspecified values.
   */
  config?: Partial<ExplosionConfig>;

  /**
   * Ring radius for positioning particle origins and shockwave.
   * @default 1
   */
  ringRadius?: number;

  /** Callback fired when all explosion effects have completed */
  onComplete?: () => void;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/** Default explosion duration in milliseconds */
const DEFAULT_DURATION_MS = 800;

/** Default particle count for visual density */
const DEFAULT_PARTICLE_COUNT = 250;

/** Default bloom intensity multiplier */
const DEFAULT_BLOOM_INTENSITY = 2;

/** Default shockwave expansion duration in milliseconds */
const DEFAULT_SHOCKWAVE_DURATION_MS = 600;

/** Default camera shake duration in milliseconds */
const DEFAULT_CAMERA_SHAKE_DURATION_MS = 80;

/** Default camera shake offset in world units */
const DEFAULT_CAMERA_SHAKE_INTENSITY = 0.02;

// =============================================================================
// COMPONENT
// =============================================================================

export function RingExplosion({
  active,
  config = {},
  ringRadius = 1,
  onComplete,
}: RingExplosionProps): React.ReactNode {
  // Merge config with defaults
  const {
    duration = DEFAULT_DURATION_MS,
    particleCount = DEFAULT_PARTICLE_COUNT,
    enableBloom = true,
    bloomIntensity = DEFAULT_BLOOM_INTENSITY,
    enableCameraShake = true,
    cameraShakeDuration = DEFAULT_CAMERA_SHAKE_DURATION_MS,
    cameraShakeIntensity = DEFAULT_CAMERA_SHAKE_INTENSITY,
    shockwaveDuration = DEFAULT_SHOCKWAVE_DURATION_MS,
  } = config;

  // Shockwave expansion target (3x ring radius)
  const SHOCKWAVE_EXPANSION_MULT = 3;
  const shockwaveEndRadius = ringRadius * SHOCKWAVE_EXPANSION_MULT;

  // Note: Particles drive the main completion callback since they have
  // the longest animation duration

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

      {/* Shockwave ring - expanding circular geometry */}
      <Shockwave
        active={active}
        startRadius={ringRadius}
        endRadius={shockwaveEndRadius}
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
