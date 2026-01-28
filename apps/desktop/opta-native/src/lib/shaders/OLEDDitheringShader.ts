/**
 * OLED Dithering Shader TypeScript Wrapper
 *
 * Creates Three.js ShaderMaterial for blue noise dithering.
 * Prevents banding on OLED displays for smooth obsidian gradients.
 *
 * @see oledDithering.glsl - The fragment shader implementation
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 */

import { ShaderMaterial, Vector2 } from 'three';
import type { OLEDDitheringUniforms } from './types';
import { fullscreenVertexShader } from './utils';

// Fragment shader inlined for bundle optimization
const oledDitheringFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;
uniform float uDitherStrength;
uniform bool uAnimated;

varying vec2 vUv;

float interleavedGradientNoise(vec2 p) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(p, magic.xy)));
}

float blueNoise(vec2 coord, float time) {
  float noise = interleavedGradientNoise(coord);
  float temporal = fract(time * 0.5);
  noise = fract(noise + temporal * 0.618033988749895);
  return noise;
}

float ditherChannel(float color, float noise, float strength) {
  float dither = (noise - 0.5) * strength;
  return color + dither / 255.0;
}

vec3 ditherColor(vec3 color, vec2 coord, float time, float strength) {
  float noiseR = blueNoise(coord, time);
  float noiseG = blueNoise(coord + vec2(17.0, 31.0), time);
  float noiseB = blueNoise(coord + vec2(59.0, 83.0), time);
  return vec3(
    ditherChannel(color.r, noiseR, strength),
    ditherChannel(color.g, noiseG, strength),
    ditherChannel(color.b, noiseB, strength)
  );
}

void main() {
  vec2 uv = vUv;
  vec4 color = texture2D(uTexture, uv);

  if (uDitherStrength < 0.001) {
    gl_FragColor = color;
    return;
  }

  vec2 screenCoord = gl_FragCoord.xy;
  float ditherTime = uAnimated ? uTime : 0.0;
  vec3 ditheredColor = ditherColor(color.rgb, screenCoord, ditherTime, uDitherStrength);
  ditheredColor = clamp(ditheredColor, 0.0, 1.0);
  gl_FragColor = vec4(ditheredColor, color.a);
}
`;

/**
 * OLED dithering configuration
 */
export interface OLEDDitheringConfig {
  /** Dithering strength (0-1), default 0.5 */
  strength?: number;
  /** Use temporal dithering for animation, default true */
  animated?: boolean;
}

/**
 * Default OLED dithering configuration
 */
const defaultOLEDConfig: Required<OLEDDitheringConfig> = {
  strength: 0.5,
  animated: true,
};

/**
 * Create OLED dithering shader uniforms
 */
export function createOLEDDitheringUniforms(config: OLEDDitheringConfig = {}): OLEDDitheringUniforms {
  const mergedConfig = { ...defaultOLEDConfig, ...config };

  return {
    uTexture: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uDitherStrength: { value: mergedConfig.strength },
    uAnimated: { value: mergedConfig.animated },
  };
}

/**
 * Create OLED dithering shader material
 *
 * @param config - OLED dithering configuration options
 * @returns Three.js ShaderMaterial with dithering effect
 *
 * @example
 * ```tsx
 * const material = createOLEDDitheringShader({ strength: 0.6 });
 * // In animation loop:
 * material.uniforms.uTime.value = clock.getElapsedTime();
 * ```
 */
export function createOLEDDitheringShader(config: OLEDDitheringConfig = {}): ShaderMaterial {
  const uniforms = createOLEDDitheringUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: oledDitheringFragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Update OLED dithering shader uniforms for animation
 *
 * @param material - The OLED dithering shader material
 * @param delta - Time delta for animation
 * @param resolution - Current resolution (optional)
 */
export function updateOLEDDitheringShader(
  material: ShaderMaterial,
  delta: number,
  resolution?: { width: number; height: number }
): void {
  const uniforms = material.uniforms as unknown as OLEDDitheringUniforms;

  // Update time
  uniforms.uTime.value += delta;

  // Update resolution if provided
  if (resolution) {
    uniforms.uResolution.value.set(resolution.width, resolution.height);
  }
}

/**
 * Set dithering strength
 *
 * @param material - The OLED dithering shader material
 * @param strength - Dithering strength (0-1)
 */
export function setDitherStrength(
  material: ShaderMaterial,
  strength: number
): void {
  const uniforms = material.uniforms as unknown as OLEDDitheringUniforms;
  uniforms.uDitherStrength.value = Math.max(0, Math.min(1, strength));
}

/**
 * Dispose OLED dithering shader material and free GPU resources
 */
export function disposeOLEDDitheringShader(material: ShaderMaterial): void {
  material.dispose();
  const uniforms = material.uniforms as unknown as OLEDDitheringUniforms;
  if (uniforms.uTexture.value) {
    uniforms.uTexture.value.dispose();
  }
}
