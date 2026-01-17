/**
 * Glass Shader TypeScript Wrapper
 *
 * Creates Three.js ShaderMaterial for premium glass effects.
 * Implements 4-layer optical glass simulation per Gemini spec.
 *
 * @see glass.glsl - The fragment shader implementation
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 */

import { ShaderMaterial, Vector2, Color, DoubleSide } from 'three';
import type { GlassUniforms, GlassConfig } from './types';
import { fullscreenVertexShader } from './utils';

// Fragment shader inlined for bundle optimization
const glassFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uBackdrop;
uniform float uBlurAmount;
uniform float uNoiseIntensity;
uniform vec2 uSpecularPosition;
uniform vec3 uSpecularColor;
uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;

varying vec2 vUv;

const float PI = 3.14159265359;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec4 blur9(sampler2D tex, vec2 uv, vec2 resolution, vec2 direction) {
  vec4 color = vec4(0.0);
  vec2 off1 = vec2(1.3846153846) * direction;
  vec2 off2 = vec2(3.2307692308) * direction;
  color += texture2D(tex, uv) * 0.2270270270;
  color += texture2D(tex, uv + (off1 / resolution)) * 0.3162162162;
  color += texture2D(tex, uv - (off1 / resolution)) * 0.3162162162;
  color += texture2D(tex, uv + (off2 / resolution)) * 0.0702702703;
  color += texture2D(tex, uv - (off2 / resolution)) * 0.0702702703;
  return color;
}

vec4 progressiveBlur(sampler2D tex, vec2 uv, vec2 resolution, float amount) {
  vec2 center = vec2(0.5);
  float edgeDist = length(uv - center) * 2.0;
  float edgeFactor = 1.0 - smoothstep(0.5, 1.0, edgeDist);
  float adjustedAmount = amount * (0.5 + edgeFactor * 0.5);
  vec4 blurH = blur9(tex, uv, resolution, vec2(adjustedAmount, 0.0));
  vec4 blurV = blur9(tex, uv, resolution, vec2(0.0, adjustedAmount));
  return (blurH + blurV) * 0.5;
}

float specularHighlight(vec2 uv, vec2 lightPos, float time) {
  float angle = time * 0.3;
  vec2 animatedPos = lightPos + vec2(cos(angle), sin(angle)) * 0.1;
  float dist = length(uv - animatedPos);
  float highlight = 1.0 - smoothstep(0.0, 0.4, dist);
  highlight = pow(highlight, 3.0);
  float secondary = 1.0 - smoothstep(0.0, 0.6, dist);
  secondary = pow(secondary, 2.0) * 0.3;
  return highlight + secondary;
}

vec3 softLight(vec3 base, float overlay) {
  vec3 result;
  float ov = overlay * 0.5 + 0.5;
  if (ov < 0.5) {
    result = base - (1.0 - 2.0 * ov) * base * (1.0 - base);
  } else {
    vec3 d = (base <= vec3(0.25))
      ? ((16.0 * base - 12.0) * base + 4.0) * base
      : sqrt(base);
    result = base + (2.0 * ov - 1.0) * (d - base);
  }
  return result;
}

void main() {
  vec2 uv = vUv;
  vec4 backdrop = progressiveBlur(uBackdrop, uv, uResolution, uBlurAmount);
  float noise = snoise(uv * 500.0 + uTime * 0.5) * uNoiseIntensity;
  vec3 colorWithNoise = softLight(backdrop.rgb, noise);
  float specular = specularHighlight(uv, uSpecularPosition, uTime);
  vec3 specularContrib = uSpecularColor * specular * 0.4;
  vec3 finalColor = colorWithNoise + specularContrib;
  float vignette = 1.0 - smoothstep(0.4, 0.9, length(uv - 0.5) * 1.2);
  finalColor *= 0.95 + vignette * 0.05;
  gl_FragColor = vec4(finalColor, backdrop.a * 0.9);
}
`;

/**
 * Default glass configuration
 */
const defaultGlassConfig: Required<GlassConfig> = {
  blurAmount: 12,
  noiseIntensity: 0.03,
  specularEnabled: true,
  animateSpecular: true,
};

/**
 * Create glass shader uniforms
 */
export function createGlassUniforms(config: GlassConfig = {}): GlassUniforms {
  const mergedConfig = { ...defaultGlassConfig, ...config };

  return {
    uBackdrop: { value: null },
    uBlurAmount: { value: mergedConfig.blurAmount },
    uNoiseIntensity: { value: mergedConfig.noiseIntensity },
    uSpecularPosition: { value: new Vector2(0.3, 0.2) },
    uSpecularColor: { value: new Color(1, 1, 1) },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uAspect: { value: 1 },
  };
}

/**
 * Create glass shader material
 *
 * @param config - Glass configuration options
 * @returns Three.js ShaderMaterial with glass effect
 *
 * @example
 * ```tsx
 * const material = createGlassShader({ blurAmount: 16 });
 * // In animation loop:
 * material.uniforms.uTime.value = clock.getElapsedTime();
 * ```
 */
export function createGlassShader(config: GlassConfig = {}): ShaderMaterial {
  const uniforms = createGlassUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: fullscreenVertexShader,
    fragmentShader: glassFragmentShader,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
}

/**
 * Update glass shader uniforms for animation
 *
 * @param material - The glass shader material
 * @param delta - Time delta for animation
 * @param resolution - Current resolution (optional)
 */
export function updateGlassShader(
  material: ShaderMaterial,
  delta: number,
  resolution?: { width: number; height: number }
): void {
  const uniforms = material.uniforms as unknown as GlassUniforms;

  // Update time
  uniforms.uTime.value += delta;

  // Update resolution if provided
  if (resolution) {
    uniforms.uResolution.value.set(resolution.width, resolution.height);
    uniforms.uAspect.value = resolution.width / resolution.height;
  }
}

/**
 * Dispose glass shader material and free GPU resources
 */
export function disposeGlassShader(material: ShaderMaterial): void {
  material.dispose();
  const uniforms = material.uniforms as unknown as GlassUniforms;
  if (uniforms.uBackdrop.value) {
    uniforms.uBackdrop.value.dispose();
  }
}
