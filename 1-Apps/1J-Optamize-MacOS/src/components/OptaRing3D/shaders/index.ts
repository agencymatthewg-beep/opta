/**
 * OptaRing3D Shaders - Barrel Exports
 *
 * WebGL shader infrastructure for the 3D Opta Ring.
 * Implements glassmorphism with fresnel rim lighting,
 * energy glow, subsurface scattering, and color temperature.
 *
 * @example
 * ```tsx
 * import {
 *   createRingShader,
 *   createRingShaderFromPreset,
 *   setRingEnergy,
 *   setRingState,
 *   RING_COLORS
 * } from './shaders';
 *
 * // Create shader from preset
 * const material = createRingShaderFromPreset('active');
 *
 * // Or with custom config
 * const customMaterial = createRingShader({
 *   energyLevel: 0.7,
 *   innerGlow: 0.5,
 *   state: 'processing'
 * });
 *
 * // Update in animation loop
 * updateRingShader(material, delta);
 * setRingEnergy(material, currentEnergy);
 * ```
 */

// =============================================================================
// RING SHADER
// =============================================================================

export {
  // Types
  type RingShaderState,
  type RingShaderUniforms,
  type RingShaderConfig,
  type RingShaderPreset,
  type TransitionType,
  // Constants
  RING_COLORS,
  ringShaderPresets,
  TRANSITION_TYPE,
  // Creation functions
  createRingShaderUniforms,
  createRingShader,
  createRingShaderFromPreset,
  // Update functions
  updateRingShader,
  setRingEnergy,
  setRingInnerGlow,
  setRingState,
  setRingColors,
  setRingFresnel,
  // Phase 41.3: Obsidian Mirror functions
  setRingMirrorReflectivity,
  setRingEnvReflection,
  setRingSpecularSharpness,
  setRingObsidianMirror,
  // Phase 41.6: Suspenseful Transition functions
  startPowerUpTransition,
  startPowerDownTransition,
  startEnergyTransition,
  setTransitionProgress,
  clearTransition,
  setAnticipationIntensity,
  isTransitionActive,
  getTransitionType,
  // Disposal
  disposeRingShader,
} from './RingShader';
