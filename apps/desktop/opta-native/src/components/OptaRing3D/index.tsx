/**
 * OptaRing3D - WebGL 3D Implementation
 *
 * Premium 3D torus ring component with glassmorphism shader material.
 * This is the primary visual protagonist of the Opta application.
 *
 * ## Features
 * - Three.js torus geometry with 96x64 segment resolution
 * - Glassmorphism fresnel shader with dynamic energy glow
 * - 7-state machine: dormant, waking, active, sleeping, processing, exploding, recovering
 * - Spring physics wake/sleep transitions (react-spring)
 * - Particle explosion effect with shockwave and bloom (Phase 27)
 * - App-wide persistent presence via fixed positioning (Phase 29)
 *
 * ## Usage Examples
 *
 * ### Standard 3D Ring
 * ```tsx
 * import { OptaRing3D } from '@/components/OptaRing3D';
 *
 * <OptaRing3D
 *   state="dormant"
 *   size="lg"
 *   onClick={() => console.log('Ring clicked')}
 * />
 * ```
 *
 * ### Ring with Explosion Effect
 * ```tsx
 * import { OptaRing3D, useExplosion, RingExplosion } from '@/components/OptaRing3D';
 *
 * const { isExploding, explode, config } = useExplosion();
 *
 * <OptaRing3D state={isExploding ? 'exploding' : 'active'} />
 * <RingExplosion active={isExploding} config={config} />
 * <button onClick={explode}>Celebrate!</button>
 * ```
 *
 * ### Persistent Ring (App-Wide)
 * ```tsx
 * import { PersistentRing } from '@/components/OptaRing3D';
 *
 * <PersistentRing currentPage="dashboard" interactive />
 * ```
 *
 * @module OptaRing3D
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see .claude/skills/opta-ring-animation.md for animation specification
 */

// =============================================================================
// CORE COMPONENTS
// =============================================================================

/** Primary 3D ring component with WebGL canvas */
export { OptaRing3D, default } from './OptaRing3D';

/** Internal Three.js mesh component (for advanced customization) */
export { RingMesh } from './RingMesh';

/** Fixed-position persistent ring wrapper */
export {
  PersistentRing,
  Z_LAYER_RING,
  Z_LAYER_CONTENT,
  Z_LAYER_NAVIGATION,
  Z_LAYER_MODALS,
} from './PersistentRing';

// =============================================================================
// EXPLOSION EFFECT COMPONENTS (Phase 27)
// =============================================================================

/** Particle emitter for explosion burst */
export { ExplosionParticles } from './ExplosionParticles';

/** Expanding ring shockwave geometry */
export { Shockwave } from './Shockwave';

/** Post-processing effects (bloom, camera shake) */
export { ExplosionEffects, AnimatedBloom, useCameraShake } from './ExplosionEffects';

/** Combined explosion orchestrator component */
export { RingExplosion } from './RingExplosion';

/** Explosion state management hook */
export { useExplosion, explosionPresets } from './useExplosion';

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/** Core ring state and size types */
export type {
  RingState,
  RingSize,
  TransitionTiming,
  TransitionEasing,
  RingVisualProperties,
} from './types';

/** Component prop types */
export type { PersistentRingProps } from './PersistentRing';

/** Explosion hook types */
export type { ExplosionConfig, ExplosionState, UseExplosionReturn } from './useExplosion';

// =============================================================================
// STATE MACHINE UTILITIES
// =============================================================================

/** Energy level ranges per state */
export { ENERGY_LEVELS } from './types';

/** State transition timing configurations */
export { STATE_TRANSITIONS } from './types';

/** Design system color palette */
export { RING_COLORS } from './types';

/** Valid state transition mappings */
export { VALID_TRANSITIONS } from './types';

/** Get transition timing between states */
export { getTransitionTiming } from './types';

/** Get default energy for a state */
export { getDefaultEnergy } from './types';

/** Clamp energy to valid range for state */
export { clampEnergyToState } from './types';

/** Calculate visual properties from state and energy */
export { getVisualProperties } from './types';

/** Validate state machine transitions */
export { isValidTransition } from './types';

/** Type guard for RingState */
export { isRingState, isRingSize } from './types';

// =============================================================================
// GLASSMORPHISM SHADER (Phase 25)
// =============================================================================

export {
  // Shader factory functions
  createRingShader,
  createRingShaderFromPreset,
  createRingShaderUniforms,

  // Runtime shader updates
  updateRingShader,
  setRingEnergy,
  setRingInnerGlow,
  setRingState,
  setRingColors,
  setRingFresnel,

  // Cleanup
  disposeRingShader,

  // Preset configurations
  RING_COLORS as SHADER_COLORS,
  ringShaderPresets,
} from './shaders';

/** Shader type definitions */
export type {
  RingShaderState,
  RingShaderUniforms,
  RingShaderConfig,
  RingShaderPreset,
} from './shaders';
