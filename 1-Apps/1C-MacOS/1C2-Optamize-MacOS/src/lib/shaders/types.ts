/**
 * Shader Types - WebGL & Three.js Uniform Types
 *
 * TypeScript definitions for shader uniforms and configurations.
 * Part of the Opta Premium Visual Effects system.
 */

import type { Color, Vector2, Texture } from 'three';

// =============================================================================
// BASE UNIFORM TYPES
// =============================================================================

/** Uniform value wrapper for Three.js */
export interface Uniform<T> {
  value: T;
}

/** Common time uniform for animations */
export interface TimeUniform {
  uTime: Uniform<number>;
}

/** Resolution uniform for responsive shaders */
export interface ResolutionUniform {
  uResolution: Uniform<Vector2>;
}

// =============================================================================
// GLASS SHADER TYPES
// =============================================================================

/**
 * Glass shader uniform configuration
 * Implements 4-layer glass effect per Gemini spec:
 * Layer 1: Backdrop (sampled from texture)
 * Layer 2: Blur Pass (Gaussian, animatable 0-20px)
 * Layer 3: Noise Overlay (Soft Light blend)
 * Layer 4: Specular Highlight (rotating conical gradient)
 */
export interface GlassUniforms extends TimeUniform, ResolutionUniform {
  /** Index signature for Three.js ShaderMaterial compatibility */
  [key: string]: Uniform<unknown>;
  /** Background texture to blur */
  uBackdrop: Uniform<Texture | null>;
  /** Blur amount in pixels (0-20) */
  uBlurAmount: Uniform<number>;
  /** Noise grain intensity (0-0.1) */
  uNoiseIntensity: Uniform<number>;
  /** Specular highlight position (normalized 0-1) */
  uSpecularPosition: Uniform<Vector2>;
  /** Specular highlight color */
  uSpecularColor: Uniform<Color>;
  /** Aspect ratio for proper UV scaling */
  uAspect: Uniform<number>;
}

export interface GlassConfig {
  blurAmount?: number;
  noiseIntensity?: number;
  specularEnabled?: boolean;
  animateSpecular?: boolean;
}

// =============================================================================
// NEON BORDER SHADER TYPES
// =============================================================================

/**
 * Neon border shader uniform configuration
 * Implements SweepGradient (conic gradient) with traveling light effect
 * and halation (core + corona exponential fade)
 */
export interface NeonBorderUniforms extends TimeUniform, ResolutionUniform {
  /** Index signature for Three.js ShaderMaterial compatibility */
  [key: string]: Uniform<unknown>;
  /** Corner radius normalized (0-1) */
  uBorderRadius: Uniform<number>;
  /** Border thickness normalized (0-0.1) */
  uBorderWidth: Uniform<number>;
  /** Primary neon color */
  uNeonColor: Uniform<Color>;
  /** Glow intensity multiplier (0-2) */
  uGlowIntensity: Uniform<number>;
  /** Animation speed multiplier */
  uAnimationSpeed: Uniform<number>;
  /** Active state (0 = off, 1 = full) */
  uActive: Uniform<number>;
}

export interface NeonBorderConfig {
  color?: string;
  intensity?: number;
  animationSpeed?: number;
  borderRadius?: number;
  borderWidth?: number;
  active?: boolean;
}

// =============================================================================
// CHROMATIC ABERRATION SHADER TYPES
// =============================================================================

/**
 * Chromatic aberration shader uniform configuration
 * Implements RGB channel separation with animated pulse
 */
export interface ChromaticAberrationUniforms extends TimeUniform {
  /** Index signature for Three.js ShaderMaterial compatibility */
  [key: string]: Uniform<unknown>;
  /** Source texture to apply effect to */
  uTexture: Uniform<Texture | null>;
  /** Aberration intensity (0-1) */
  uIntensity: Uniform<number>;
  /** Animation phase for pulsing (0-1) */
  uAnimationPhase: Uniform<number>;
  /** Center point for radial aberration */
  uCenter: Uniform<Vector2>;
  /** Use radial (true) or linear (false) mode */
  uRadialMode: Uniform<boolean>;
}

export interface ChromaticConfig {
  intensity?: number;
  animated?: boolean;
  radialMode?: boolean;
  center?: { x: number; y: number };
}

/** Preset configurations for chromatic aberration */
export const chromaticPresets = {
  loading: { intensity: 0.6, animated: true },
  transition: { intensity: 0.3, animated: false },
  subtle: { intensity: 0.15, animated: false },
  intense: { intensity: 0.8, animated: true },
} as const;

export type ChromaticPreset = keyof typeof chromaticPresets;

// =============================================================================
// OLED DITHERING SHADER TYPES
// =============================================================================

/**
 * OLED dithering shader uniform configuration
 * Implements blue noise dithering to prevent banding on OLED displays
 */
export interface OLEDDitheringUniforms extends TimeUniform, ResolutionUniform {
  /** Index signature for Three.js ShaderMaterial compatibility */
  [key: string]: Uniform<unknown>;
  /** Source texture */
  uTexture: Uniform<Texture | null>;
  /** Dithering strength (0-1) */
  uDitherStrength: Uniform<number>;
  /** Use animated noise (temporal dithering) */
  uAnimated: Uniform<boolean>;
}

// =============================================================================
// WEBGL CONTEXT TYPES
// =============================================================================

export interface WebGLState {
  contextLost: boolean;
  contextRestored: boolean;
  lastError: string | null;
}

export interface ShaderPerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuMemory?: number;
}
