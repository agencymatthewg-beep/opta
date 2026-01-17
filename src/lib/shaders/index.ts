/**
 * Shader Library - Barrel Exports
 *
 * WebGL shader infrastructure for Opta premium visual effects.
 * Implements glass, neon, chromatic aberration, and OLED dithering.
 *
 * @example
 * ```tsx
 * import {
 *   createGlassShader,
 *   createNeonBorderShader,
 *   createChromaticShader,
 *   chromaticPresets
 * } from '@/lib/shaders';
 *
 * // Create shaders
 * const glass = createGlassShader({ blurAmount: 16 });
 * const neon = createNeonBorderShader({ color: '#8b5cf6' });
 * const chromatic = createChromaticShader(chromaticPresets.loading);
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  Uniform,
  TimeUniform,
  ResolutionUniform,
  GlassUniforms,
  GlassConfig,
  NeonBorderUniforms,
  NeonBorderConfig,
  ChromaticAberrationUniforms,
  ChromaticConfig,
  ChromaticPreset,
  OLEDDitheringUniforms,
  WebGLState,
  ShaderPerformanceMetrics,
} from './types';

export { chromaticPresets } from './types';

// =============================================================================
// UTILITIES
// =============================================================================

export {
  // Color utilities
  cssToThreeColor,
  getOptaPrimaryColor,
  getOptaGlowColorArray,
  // Uniform helpers
  uniform,
  createTimeUniform,
  createResolutionUniform,
  updateTimeUniform,
  // Vertex shaders
  fullscreenVertexShader,
  passthroughVertexShader,
  // WebGL utilities
  isWebGLAvailable,
  isWebGL2Available,
  getMaxTextureSize,
  // Performance utilities
  createFPSCounter,
  prefersReducedMotion,
  // Math utilities
  lerp,
  clamp,
  smoothstep,
  mapRange,
} from './utils';

// =============================================================================
// GLASS SHADER
// =============================================================================

export {
  createGlassUniforms,
  createGlassShader,
  updateGlassShader,
  disposeGlassShader,
} from './GlassShader';

// =============================================================================
// NEON BORDER SHADER
// =============================================================================

export {
  createNeonBorderUniforms,
  createNeonBorderShader,
  updateNeonBorderShader,
  setNeonBorderActive,
  setNeonBorderColor,
  disposeNeonBorderShader,
} from './NeonBorderShader';

// =============================================================================
// CHROMATIC ABERRATION SHADER
// =============================================================================

export {
  createChromaticUniforms,
  createChromaticShader,
  createChromaticShaderFromPreset,
  updateChromaticShader,
  setChromaticPhase,
  setChromaticIntensity,
  disposeChromaticShader,
} from './ChromaticShader';

// =============================================================================
// OLED DITHERING SHADER
// =============================================================================

export {
  createOLEDDitheringUniforms,
  createOLEDDitheringShader,
  updateOLEDDitheringShader,
  setDitherStrength,
  disposeOLEDDitheringShader,
} from './OLEDDitheringShader';

export type { OLEDDitheringConfig } from './OLEDDitheringShader';

// =============================================================================
// DEEP GLOW SHADER
// =============================================================================

export {
  createDeepGlowUniforms,
  createDeepGlowShader,
  updateDeepGlowShader,
  setDeepGlowIntensity,
  setDeepGlowColor,
  setDeepGlowActive,
  disposeDeepGlowShader,
  getIntensityColor,
  intensityColors,
} from './DeepGlowShader';

export type { DeepGlowUniforms, DeepGlowConfig } from './DeepGlowShader';
