/**
 * Deep Glow Shader TypeScript Wrapper
 *
 * Creates Three.js ShaderMaterial for reactive deep glow effects.
 * Responds to system load metrics with multi-layer corona animation.
 *
 * @see deepGlow.glsl - The fragment shader implementation
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { ShaderMaterial, Vector2, AdditiveBlending, Color } from 'three';
import { fullscreenVertexShader, cssToThreeColor } from './utils';
import type { Uniform } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface DeepGlowUniforms {
  [key: string]: Uniform<unknown>;
  uTime: Uniform<number>;
  uResolution: Uniform<Vector2>;
  uIntensity: Uniform<number>;
  uColor: Uniform<Color>;
  uPulseSpeed: Uniform<number>;
  uActive: Uniform<number>;
}

export interface DeepGlowConfig {
  intensity?: number;
  color?: string;
  pulseSpeed?: number;
  active?: boolean;
}

// Semantic color mapping based on intensity thresholds
export const intensityColors = {
  idle: '#8b5cf6',     // Purple - intensity < 0.3
  active: '#06b6d4',   // Cyan - intensity 0.3-0.6
  warning: '#f59e0b',  // Amber/Orange - intensity 0.6-0.85
  critical: '#ef4444', // Red - intensity > 0.85
} as const;

// =============================================================================
// FRAGMENT SHADER (inlined for bundle optimization)
// =============================================================================

const deepGlowFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity;
uniform vec3 uColor;
uniform float uPulseSpeed;
uniform float uActive;

varying vec2 vUv;

const float PI = 3.14159265359;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sdRoundedRectGlow(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

vec4 deepGlowCorona(float dist, vec3 color, float intensity, float time) {
  float outerCorona = exp(-abs(dist) * 2.0) * intensity * 0.4;
  float innerCore = exp(-abs(dist) * 8.0) * intensity * 0.8;
  float innerBright = exp(-abs(dist) * 20.0) * intensity;

  float shimmerNoise = noise(vUv * 10.0 + time * 0.5);
  float shimmer = shimmerNoise * 0.15 * intensity;

  float pulse = sin(time * 2.0) * 0.1 + 1.0;
  float breathe = mix(1.0, pulse, intensity);

  vec3 coreColor = mix(color, vec3(1.0), 0.5);
  vec3 midColor = color * 1.2;
  vec3 outerColor = color * 0.6;

  vec3 finalColor = coreColor * innerBright * breathe
                  + midColor * innerCore
                  + outerColor * outerCorona
                  + color * shimmer;

  float finalAlpha = innerBright + innerCore * 0.7 + outerCorona * 0.4 + shimmer * 0.3;
  finalAlpha = clamp(finalAlpha, 0.0, 1.0);

  return vec4(finalColor, finalAlpha);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  vec2 rectSize = vec2(0.9 * aspect, 0.9);
  float cornerRadius = 0.12;

  float dist = sdRoundedRectGlow(uv, rectSize, cornerRadius);
  float edgeDist = max(dist, 0.0);

  vec4 glow = deepGlowCorona(edgeDist, uColor, uIntensity, uTime * uPulseSpeed);
  glow *= uActive;

  if (uIntensity > 0.85) {
    float criticalPulse = sin(uTime * 4.0) * 0.3 + 0.7;
    glow.rgb *= criticalPulse;
  }

  gl_FragColor = glow;
}
`;

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const defaultDeepGlowConfig: Required<DeepGlowConfig> = {
  intensity: 0.3,
  color: intensityColors.idle,
  pulseSpeed: 1,
  active: true,
};

// =============================================================================
// SHADER FUNCTIONS
// =============================================================================

/**
 * Get semantic color based on intensity level
 *
 * @param intensity - System load intensity (0-1)
 * @returns CSS color string
 */
export function getIntensityColor(intensity: number): string {
  if (intensity > 0.85) return intensityColors.critical;
  if (intensity > 0.6) return intensityColors.warning;
  if (intensity > 0.3) return intensityColors.active;
  return intensityColors.idle;
}

/**
 * Create deep glow shader uniforms
 */
export function createDeepGlowUniforms(config: DeepGlowConfig = {}): DeepGlowUniforms {
  const mergedConfig = { ...defaultDeepGlowConfig, ...config };
  const glowColor = cssToThreeColor(mergedConfig.color);

  return {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uIntensity: { value: mergedConfig.intensity },
    uColor: { value: glowColor },
    uPulseSpeed: { value: mergedConfig.pulseSpeed },
    uActive: { value: mergedConfig.active ? 1 : 0 },
  };
}

/**
 * Create deep glow shader material
 *
 * @param config - Deep glow configuration options
 * @returns Three.js ShaderMaterial with deep glow effect
 *
 * @example
 * ```tsx
 * const material = createDeepGlowShader({
 *   intensity: 0.5,
 *   color: '#06b6d4'
 * });
 * // In animation loop:
 * updateDeepGlowShader(material, delta, { width, height }, cpuLoad);
 * ```
 */
export function createDeepGlowShader(config: DeepGlowConfig = {}): ShaderMaterial {
  const uniforms = createDeepGlowUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: deepGlowFragmentShader,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

/**
 * Update deep glow shader uniforms for animation
 *
 * @param material - The deep glow shader material
 * @param delta - Time delta for animation
 * @param resolution - Current resolution (optional)
 * @param intensity - New intensity value (optional)
 */
export function updateDeepGlowShader(
  material: ShaderMaterial,
  delta: number,
  resolution?: { width: number; height: number },
  intensity?: number
): void {
  const uniforms = material.uniforms as unknown as DeepGlowUniforms;

  // Update time
  uniforms.uTime.value += delta;

  // Update resolution if provided
  if (resolution) {
    uniforms.uResolution.value.set(resolution.width, resolution.height);
  }

  // Update intensity and auto-adjust color
  if (intensity !== undefined) {
    uniforms.uIntensity.value = intensity;
    uniforms.uColor.value = cssToThreeColor(getIntensityColor(intensity));
  }
}

/**
 * Set deep glow intensity directly
 *
 * @param material - The deep glow shader material
 * @param intensity - New intensity value (0-1)
 * @param autoColor - Automatically set color based on intensity (default: true)
 */
export function setDeepGlowIntensity(
  material: ShaderMaterial,
  intensity: number,
  autoColor: boolean = true
): void {
  const uniforms = material.uniforms as unknown as DeepGlowUniforms;
  uniforms.uIntensity.value = Math.max(0, Math.min(1, intensity));

  if (autoColor) {
    uniforms.uColor.value = cssToThreeColor(getIntensityColor(intensity));
  }
}

/**
 * Set deep glow color directly (overrides auto-color)
 *
 * @param material - The deep glow shader material
 * @param color - CSS color string
 */
export function setDeepGlowColor(
  material: ShaderMaterial,
  color: string
): void {
  const uniforms = material.uniforms as unknown as DeepGlowUniforms;
  uniforms.uColor.value = cssToThreeColor(color);
}

/**
 * Set deep glow active state
 *
 * @param material - The deep glow shader material
 * @param active - Whether the glow should be visible
 */
export function setDeepGlowActive(
  material: ShaderMaterial,
  active: boolean
): void {
  const uniforms = material.uniforms as unknown as DeepGlowUniforms;
  uniforms.uActive.value = active ? 1 : 0;
}

/**
 * Dispose deep glow shader material and free GPU resources
 */
export function disposeDeepGlowShader(material: ShaderMaterial): void {
  material.dispose();
}
