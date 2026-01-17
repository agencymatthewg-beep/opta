/**
 * Chromatic Aberration Shader TypeScript Wrapper
 *
 * Creates Three.js ShaderMaterial for RGB channel separation effects.
 * Used for loading states, transitions, and visual feedback.
 *
 * @see chromaticAberration.glsl - The fragment shader implementation
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { ShaderMaterial, Vector2 } from 'three';
import type { ChromaticAberrationUniforms, ChromaticConfig, ChromaticPreset } from './types';
import { chromaticPresets } from './types';
import { fullscreenVertexShader } from './utils';

// Fragment shader inlined for bundle optimization
const chromaticFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;
uniform float uAnimationPhase;
uniform vec2 uCenter;
uniform bool uRadialMode;

varying vec2 vUv;

float pulse(float time) {
  return sin(time * 3.0) * 0.5 + 0.5;
}

vec2 getOffsetDirection(vec2 uv, vec2 center, bool radial) {
  if (radial) {
    return normalize(uv - center);
  }
  return vec2(1.0, 0.0);
}

vec4 chromaticAberration(sampler2D tex, vec2 uv, vec2 direction, float intensity) {
  float rOffset = intensity * 0.012;
  float gOffset = 0.0;
  float bOffset = -intensity * 0.012;

  vec2 rUv = uv + direction * rOffset;
  vec2 gUv = uv + direction * gOffset;
  vec2 bUv = uv + direction * bOffset;

  float r = texture2D(tex, rUv).r;
  float g = texture2D(tex, gUv).g;
  float b = texture2D(tex, bUv).b;
  float a = texture2D(tex, uv).a;

  return vec4(r, g, b, a);
}

float distanceIntensity(vec2 uv, vec2 center) {
  float dist = length(uv - center);
  return dist * dist * 2.0;
}

void main() {
  vec2 uv = vUv;

  if (uAnimationPhase < 0.001) {
    gl_FragColor = texture2D(uTexture, uv);
    return;
  }

  float pulseValue = pulse(uTime);
  float animatedIntensity = uIntensity * (0.5 + pulseValue * 0.5) * uAnimationPhase;

  vec2 direction = getOffsetDirection(uv, uCenter, uRadialMode);

  if (uRadialMode) {
    float distMod = distanceIntensity(uv, uCenter);
    animatedIntensity *= distMod;
  }

  vec4 color = chromaticAberration(uTexture, uv, direction, animatedIntensity);

  if (animatedIntensity > 0.5) {
    float fringe = smoothstep(0.5, 1.0, animatedIntensity) * 0.1;
    color.r += fringe * pulseValue;
    color.b += fringe * (1.0 - pulseValue);
  }

  gl_FragColor = color;
}
`;

/**
 * Default chromatic aberration configuration
 */
const defaultChromaticConfig: Required<ChromaticConfig> = {
  intensity: 0.5,
  animated: true,
  radialMode: true,
  center: { x: 0.5, y: 0.5 },
};

/**
 * Create chromatic aberration shader uniforms
 */
export function createChromaticUniforms(config: ChromaticConfig = {}): ChromaticAberrationUniforms {
  const mergedConfig = { ...defaultChromaticConfig, ...config };

  return {
    uTexture: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: mergedConfig.intensity },
    uAnimationPhase: { value: 0 }, // Start at 0 (effect off)
    uCenter: { value: new Vector2(mergedConfig.center.x, mergedConfig.center.y) },
    uRadialMode: { value: mergedConfig.radialMode },
  };
}

/**
 * Create chromatic aberration shader material
 *
 * @param config - Chromatic aberration configuration options
 * @returns Three.js ShaderMaterial with chromatic aberration effect
 *
 * @example
 * ```tsx
 * const material = createChromaticShader({ intensity: 0.6 });
 * // Start loading effect:
 * material.uniforms.uAnimationPhase.value = 1;
 * // In animation loop:
 * material.uniforms.uTime.value = clock.getElapsedTime();
 * ```
 */
export function createChromaticShader(config: ChromaticConfig = {}): ShaderMaterial {
  const uniforms = createChromaticUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: chromaticFragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Create chromatic shader from preset
 *
 * @param preset - Preset name ('loading', 'transition', 'subtle', 'intense')
 * @returns Configured ShaderMaterial
 */
export function createChromaticShaderFromPreset(preset: ChromaticPreset): ShaderMaterial {
  const presetConfig = chromaticPresets[preset];
  return createChromaticShader({
    intensity: presetConfig.intensity,
    animated: presetConfig.animated,
  });
}

/**
 * Update chromatic shader uniforms for animation
 *
 * @param material - The chromatic shader material
 * @param delta - Time delta for animation
 */
export function updateChromaticShader(
  material: ShaderMaterial,
  delta: number
): void {
  const uniforms = material.uniforms as unknown as ChromaticAberrationUniforms;
  uniforms.uTime.value += delta;
}

/**
 * Set chromatic effect animation phase
 * Animate from 0 to 1 when loading starts, 1 to 0 when loading ends
 *
 * @param material - The chromatic shader material
 * @param phase - Animation phase (0 = off, 1 = full effect)
 */
export function setChromaticPhase(
  material: ShaderMaterial,
  phase: number
): void {
  const uniforms = material.uniforms as unknown as ChromaticAberrationUniforms;
  uniforms.uAnimationPhase.value = Math.max(0, Math.min(1, phase));
}

/**
 * Set chromatic effect intensity
 *
 * @param material - The chromatic shader material
 * @param intensity - Effect intensity (0-1)
 */
export function setChromaticIntensity(
  material: ShaderMaterial,
  intensity: number
): void {
  const uniforms = material.uniforms as unknown as ChromaticAberrationUniforms;
  uniforms.uIntensity.value = Math.max(0, Math.min(1, intensity));
}

/**
 * Dispose chromatic shader material and free GPU resources
 */
export function disposeChromaticShader(material: ShaderMaterial): void {
  material.dispose();
  const uniforms = material.uniforms as unknown as ChromaticAberrationUniforms;
  if (uniforms.uTexture.value) {
    uniforms.uTexture.value.dispose();
  }
}

// Re-export presets for convenience
export { chromaticPresets };
