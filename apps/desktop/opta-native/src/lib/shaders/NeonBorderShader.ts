/**
 * Neon Border Shader TypeScript Wrapper
 *
 * Creates Three.js ShaderMaterial for traveling neon border effects.
 * Implements SweepGradient with halation glow per Gemini spec.
 *
 * @see neonBorder.glsl - The fragment shader implementation
 * @see DESIGN_SYSTEM.md - The Opta Ring / Neon Effects
 */

import { ShaderMaterial, Vector2, AdditiveBlending } from 'three';
import type { NeonBorderUniforms, NeonBorderConfig } from './types';
import { fullscreenVertexShader, cssToThreeColor } from './utils';

// Fragment shader inlined for bundle optimization
const neonBorderFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uBorderRadius;
uniform float uBorderWidth;
uniform vec3 uNeonColor;
uniform float uGlowIntensity;
uniform float uAnimationSpeed;
uniform float uActive;

varying vec2 vUv;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

float sdRoundedRect(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float sweepGradient(vec2 uv, float time, float speed) {
  float angle = atan(uv.y, uv.x);
  float sweep = fract(angle / TWO_PI + time * speed);
  float light = smoothstep(0.0, 0.3, sweep) * (1.0 - smoothstep(0.3, 0.7, sweep));
  float secondary = smoothstep(0.6, 0.7, sweep) * (1.0 - smoothstep(0.7, 0.9, sweep)) * 0.3;
  return light + secondary;
}

vec4 neonHalation(float dist, vec3 color, float intensity) {
  float core = exp(-abs(dist) * 30.0) * intensity;
  float corona = exp(-abs(dist) * 8.0) * intensity * 0.6;
  float haze = exp(-abs(dist) * 3.0) * intensity * 0.15;
  vec3 coreColor = mix(color, vec3(1.0), 0.7);
  vec3 coronaColor = color * 1.2;
  vec3 hazeColor = color * 0.5;
  vec3 finalColor = coreColor * core + coronaColor * corona + hazeColor * haze;
  float finalAlpha = core + corona * 0.8 + haze * 0.3;
  return vec4(finalColor, finalAlpha);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  vec2 rectSize = vec2(0.85 * aspect, 0.85);
  float dist = sdRoundedRect(uv, rectSize, uBorderRadius);
  float sweep = sweepGradient(uv, uTime, uAnimationSpeed);

  float borderOuter = smoothstep(uBorderWidth, 0.0, dist);
  float borderInner = smoothstep(-uBorderWidth, 0.0, dist);
  float border = borderOuter * borderInner;

  float travelingLight = border * (0.3 + sweep * 0.7);

  vec4 glow = neonHalation(dist, uNeonColor, uGlowIntensity * uActive);
  glow.rgb += uNeonColor * travelingLight * uActive;
  glow.a = max(glow.a, travelingLight * uActive);
  glow *= uActive;

  gl_FragColor = glow;
}
`;

/**
 * Default neon border configuration
 */
const defaultNeonConfig: Required<NeonBorderConfig> = {
  color: '#8b5cf6', // Opta primary purple
  intensity: 0.8,
  animationSpeed: 1,
  borderRadius: 0.08, // Normalized (roughly 12px on typical element)
  borderWidth: 0.015, // Normalized border thickness
  active: true,
};

/**
 * Create neon border shader uniforms
 */
export function createNeonBorderUniforms(config: NeonBorderConfig = {}): NeonBorderUniforms {
  const mergedConfig = { ...defaultNeonConfig, ...config };
  const neonColor = cssToThreeColor(mergedConfig.color);

  return {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uBorderRadius: { value: mergedConfig.borderRadius },
    uBorderWidth: { value: mergedConfig.borderWidth },
    uNeonColor: { value: neonColor },
    uGlowIntensity: { value: mergedConfig.intensity },
    uAnimationSpeed: { value: mergedConfig.animationSpeed },
    uActive: { value: mergedConfig.active ? 1 : 0 },
  };
}

/**
 * Create neon border shader material
 *
 * @param config - Neon border configuration options
 * @returns Three.js ShaderMaterial with neon border effect
 *
 * @example
 * ```tsx
 * const material = createNeonBorderShader({
 *   color: '#8b5cf6',
 *   intensity: 1.0,
 *   animationSpeed: 0.5
 * });
 * // In animation loop:
 * material.uniforms.uTime.value = clock.getElapsedTime();
 * ```
 */
export function createNeonBorderShader(config: NeonBorderConfig = {}): ShaderMaterial {
  const uniforms = createNeonBorderUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: neonBorderFragmentShader,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

/**
 * Update neon border shader uniforms for animation
 *
 * @param material - The neon border shader material
 * @param delta - Time delta for animation
 * @param resolution - Current resolution (optional)
 */
export function updateNeonBorderShader(
  material: ShaderMaterial,
  delta: number,
  resolution?: { width: number; height: number }
): void {
  const uniforms = material.uniforms as unknown as NeonBorderUniforms;

  // Update time
  uniforms.uTime.value += delta;

  // Update resolution if provided
  if (resolution) {
    uniforms.uResolution.value.set(resolution.width, resolution.height);
  }
}

/**
 * Set neon border active state (for enter/exit animations)
 *
 * @param material - The neon border shader material
 * @param active - Whether the border should be visible
 */
export function setNeonBorderActive(
  material: ShaderMaterial,
  active: boolean
): void {
  const uniforms = material.uniforms as unknown as NeonBorderUniforms;
  uniforms.uActive.value = active ? 1 : 0;
}

/**
 * Update neon border color
 *
 * @param material - The neon border shader material
 * @param color - New color (CSS color string)
 */
export function setNeonBorderColor(
  material: ShaderMaterial,
  color: string
): void {
  const uniforms = material.uniforms as unknown as NeonBorderUniforms;
  uniforms.uNeonColor.value = cssToThreeColor(color);
}

/**
 * Dispose neon border shader material and free GPU resources
 */
export function disposeNeonBorderShader(material: ShaderMaterial): void {
  material.dispose();
}
