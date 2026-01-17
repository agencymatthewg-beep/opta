/**
 * OptaRing3D - WebGL 3D Implementation
 *
 * A premium 3D replacement for the PNG-based OptaRing with:
 * - Real 3D torus geometry
 * - Wake-up animation (rotates to face camera)
 * - Explosion effect on click (Phase 27)
 * - Dynamic energy glow
 * - Full state machine lifecycle
 * - App-wide persistent presence (Phase 29)
 *
 * @example
 * ```tsx
 * import { OptaRing3D, PersistentRing, useExplosion, RingExplosion } from '@/components/OptaRing3D';
 *
 * // Standard 3D ring
 * <OptaRing3D
 *   state="dormant"
 *   size="lg"
 *   onClick={() => console.log('Ring clicked')}
 * />
 *
 * // Ring with explosion effect (Phase 27)
 * const { isExploding, explode, config } = useExplosion();
 * <RingExplosion active={isExploding} config={config} />
 *
 * // App-wide persistent ring (fixed position)
 * <PersistentRing
 *   currentPage="dashboard"
 *   interactive
 * />
 * ```
 *
 * @see OPTA_RING_ANIMATION_SPEC.md for full specification
 * @see Phase 27 for explosion effect
 * @see Phase 29 for persistent ring behavior
 */

export { OptaRing3D, default } from './OptaRing3D';
export { RingMesh } from './RingMesh';
export {
  PersistentRing,
  Z_LAYER_RING,
  Z_LAYER_CONTENT,
  Z_LAYER_NAVIGATION,
  Z_LAYER_MODALS,
} from './PersistentRing';

// Phase 27: Explosion Effect components
export { ExplosionParticles } from './ExplosionParticles';
export { Shockwave } from './Shockwave';
export { ExplosionEffects, AnimatedBloom, useCameraShake } from './ExplosionEffects';
export { RingExplosion } from './RingExplosion';
export { useExplosion, explosionPresets } from './useExplosion';

// Export types from dedicated types file
export type {
  RingState,
  RingSize,
  TransitionTiming,
  RingVisualProperties,
} from './types';

export type { PersistentRingProps } from './PersistentRing';
export type { ExplosionConfig, ExplosionState, UseExplosionReturn } from './useExplosion';

export {
  ENERGY_LEVELS,
  STATE_TRANSITIONS,
  RING_COLORS,
  VALID_TRANSITIONS,
  getTransitionTiming,
  getDefaultEnergy,
  clampEnergyToState,
  getVisualProperties,
  isValidTransition,
} from './types';

// Phase 25: Glassmorphism Shader exports
export {
  // Shader creation
  createRingShader,
  createRingShaderFromPreset,
  createRingShaderUniforms,
  // Shader update functions
  updateRingShader,
  setRingEnergy,
  setRingInnerGlow,
  setRingState,
  setRingColors,
  setRingFresnel,
  // Disposal
  disposeRingShader,
  // Constants
  RING_COLORS as SHADER_COLORS,
  ringShaderPresets,
} from './shaders';

export type {
  RingShaderState,
  RingShaderUniforms,
  RingShaderConfig,
  RingShaderPreset,
} from './shaders';
