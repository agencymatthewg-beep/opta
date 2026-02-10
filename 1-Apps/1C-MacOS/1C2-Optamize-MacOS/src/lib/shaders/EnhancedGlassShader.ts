/**
 * Enhanced Glass Shader - GPU Chrome Panel Rendering
 *
 * Advanced glassmorphism shader for the Chrome system.
 * Extends the base GlassShader with:
 * - Energy state variants (dormant, active, pulse, storm)
 * - Depth-based blur intensity
 * - Fresnel rim lighting
 * - Traveling light borders
 * - Performance-scaled quality
 *
 * @see ChromeCanvas.tsx - Uses this shader
 * @see GlassShader.ts - Base implementation
 * @see DESIGN_SYSTEM.md - Glass Effects Guidelines
 */

import { ShaderMaterial, Vector2, Color, DoubleSide, AdditiveBlending } from 'three';
import type { Uniform } from './types';

// =============================================================================
// TYPES
// =============================================================================

/** Energy state for visual reactivity */
export type GlassEnergyState = 'dormant' | 'active' | 'pulse' | 'storm';

/** Quality tier for performance scaling */
export type GlassQualityTier = 'high' | 'medium' | 'low' | 'minimal';

/** Enhanced glass shader uniforms */
export interface EnhancedGlassUniforms {
  [key: string]: Uniform<unknown>;
  /** Animation time */
  uTime: Uniform<number>;
  /** Panel aspect ratio */
  uAspect: Uniform<number>;
  /** Viewport resolution */
  uResolution: Uniform<Vector2>;
  /** Border radius (normalized 0-1) */
  uBorderRadius: Uniform<number>;
  /** Blur intensity (0-1) */
  uBlurIntensity: Uniform<number>;
  /** Energy level (0=dormant, 1=storm) */
  uEnergy: Uniform<number>;
  /** Primary energy color */
  uEnergyColor: Uniform<Color>;
  /** Secondary energy color (for gradients) */
  uEnergyColorSecondary: Uniform<Color>;
  /** Enable glow borders (0 or 1) */
  uGlowBorders: Uniform<number>;
  /** Z-depth for parallax (0-1) */
  uDepth: Uniform<number>;
  /** Fresnel intensity (0-1) */
  uFresnelIntensity: Uniform<number>;
  /** Noise intensity for texture (0-1) */
  uNoiseIntensity: Uniform<number>;
  /** Animation speed multiplier */
  uAnimationSpeed: Uniform<number>;
  /** Quality tier (0=minimal, 3=high) */
  uQualityTier: Uniform<number>;
}

/** Configuration options for enhanced glass */
export interface EnhancedGlassConfig {
  /** Border radius in normalized units */
  borderRadius?: number;
  /** Blur intensity (0-1) */
  blurIntensity?: number;
  /** Enable glowing borders */
  glowBorders?: boolean;
  /** Z-depth for parallax effects */
  depth?: number;
  /** Fresnel rim light intensity */
  fresnelIntensity?: number;
  /** Noise texture intensity */
  noiseIntensity?: number;
  /** Animation speed multiplier */
  animationSpeed?: number;
  /** Initial energy state */
  energyState?: GlassEnergyState;
  /** Quality tier */
  quality?: GlassQualityTier;
  /** Custom energy color */
  energyColor?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Energy state to numeric value mapping */
export const ENERGY_VALUES: Record<GlassEnergyState, number> = {
  dormant: 0.1,
  active: 0.4,
  pulse: 0.7,
  storm: 1.0,
};

/** Quality tier to numeric value mapping */
const QUALITY_VALUES: Record<GlassQualityTier, number> = {
  high: 3,
  medium: 2,
  low: 1,
  minimal: 0,
};

/** Default energy colors by state */
export const ENERGY_COLORS: Record<GlassEnergyState, { primary: Color; secondary: Color }> = {
  dormant: {
    primary: new Color(0x8b5cf6).multiplyScalar(0.3),
    secondary: new Color(0x6366f1).multiplyScalar(0.2),
  },
  active: {
    primary: new Color(0x8b5cf6).multiplyScalar(0.6),
    secondary: new Color(0xa855f7).multiplyScalar(0.4),
  },
  pulse: {
    primary: new Color(0xa855f7),
    secondary: new Color(0xc084fc),
  },
  storm: {
    primary: new Color(0xc084fc),
    secondary: new Color(0xe879f9),
  },
};

/** Default configuration */
const DEFAULT_CONFIG: Required<EnhancedGlassConfig> = {
  borderRadius: 0.02,
  blurIntensity: 0.5,
  glowBorders: false,
  depth: 0,
  fresnelIntensity: 0.5,
  noiseIntensity: 0.03,
  animationSpeed: 1.0,
  energyState: 'dormant',
  quality: 'high',
  energyColor: '#8b5cf6',
};

// =============================================================================
// SHADERS
// =============================================================================

/** Vertex shader */
const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;

/** Fragment shader - full quality version */
const fragmentShaderHigh = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform vec2 uResolution;
uniform float uBorderRadius;
uniform float uBlurIntensity;
uniform float uEnergy;
uniform vec3 uEnergyColor;
uniform vec3 uEnergyColorSecondary;
uniform float uGlowBorders;
uniform float uDepth;
uniform float uFresnelIntensity;
uniform float uNoiseIntensity;
uniform float uAnimationSpeed;
uniform float uQualityTier;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Rounded rectangle SDF
float roundedRectSDF(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

// Simplex noise for organic texture
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
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

// Soft light blend mode
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

// =============================================================================
// MAIN
// =============================================================================

void main() {
  float animTime = uTime * uAnimationSpeed;

  // Center UV for SDF calculations
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  // Calculate rounded rect distance
  vec2 size = vec2(uAspect, 1.0) - uBorderRadius * 2.0;
  float d = roundedRectSDF(uv, size, uBorderRadius);

  // ==========================================================================
  // LAYER 1: Glass Fill
  // ==========================================================================

  float fill = 1.0 - smoothstep(-0.01, 0.01, d);

  // Base glass color - deep obsidian with subtle purple
  vec3 glassColor = vec3(0.04, 0.02, 0.08);

  // Depth-based color shift (panels further back are darker)
  glassColor *= 1.0 - uDepth * 0.3;

  // ==========================================================================
  // LAYER 2: Fresnel Rim Lighting
  // ==========================================================================

  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
  fresnel *= uFresnelIntensity * uEnergy;

  vec3 fresnelColor = mix(uEnergyColor, uEnergyColorSecondary, fresnel);

  // ==========================================================================
  // LAYER 3: Border Glow
  // ==========================================================================

  float borderDist = abs(d);
  float borderGlow = 0.0;

  if (uGlowBorders > 0.5) {
    // Core glow (sharp)
    borderGlow = exp(-borderDist * 40.0) * uEnergy * 0.8;

    // Corona glow (soft)
    borderGlow += exp(-borderDist * 15.0) * uEnergy * 0.3;

    // Halation (very soft outer glow)
    borderGlow += exp(-borderDist * 5.0) * uEnergy * 0.1;
  }

  // ==========================================================================
  // LAYER 4: Traveling Light
  // ==========================================================================

  float travelLight = 0.0;

  if (uGlowBorders > 0.5 && uQualityTier >= 2.0) {
    // Calculate perimeter position (0-4, representing 4 edges)
    float perimeterPos = 0.0;

    // Top edge
    if (vUv.y > 0.97) {
      perimeterPos = vUv.x;
    }
    // Right edge
    else if (vUv.x > 0.97) {
      perimeterPos = 1.0 + (1.0 - vUv.y);
    }
    // Bottom edge
    else if (vUv.y < 0.03) {
      perimeterPos = 2.0 + (1.0 - vUv.x);
    }
    // Left edge
    else if (vUv.x < 0.03) {
      perimeterPos = 3.0 + vUv.y;
    }

    // Normalize to 0-1
    perimeterPos /= 4.0;

    // Traveling light position
    float travelPos = fract(animTime * 0.25);

    // Gaussian falloff for smooth light
    float distToLight = min(abs(perimeterPos - travelPos),
                            min(abs(perimeterPos - travelPos + 1.0),
                                abs(perimeterPos - travelPos - 1.0)));

    travelLight = exp(-pow(distToLight * 12.0, 2.0)) * uEnergy * 0.6;
  }

  // ==========================================================================
  // LAYER 5: Noise Texture
  // ==========================================================================

  float noise = 0.0;
  if (uQualityTier >= 1.0) {
    noise = snoise(vUv * 100.0 + animTime * 0.3) * uNoiseIntensity;
    noise += snoise(vUv * 200.0 - animTime * 0.2) * uNoiseIntensity * 0.5;
  }

  // ==========================================================================
  // LAYER 6: Energy Pulse (for pulse/storm states)
  // ==========================================================================

  float pulse = 0.0;
  if (uEnergy > 0.5) {
    float pulsePhase = fract(animTime * 2.0);
    pulse = sin(pulsePhase * 3.14159) * (uEnergy - 0.5) * 0.5;
  }

  // ==========================================================================
  // COMBINE LAYERS
  // ==========================================================================

  // Base glass with noise
  vec3 finalColor = softLight(glassColor, noise);

  // Add energy-colored effects
  finalColor += uEnergyColor * borderGlow;
  finalColor += mix(uEnergyColor, uEnergyColorSecondary, 0.5) * travelLight;
  finalColor += fresnelColor * fresnel;
  finalColor += uEnergyColor * pulse;

  // Fill alpha (glass transparency)
  float fillAlpha = fill * (0.12 + uEnergy * 0.08);

  // Glow alpha (additive)
  float glowAlpha = borderGlow * 0.7 + travelLight * 0.6 + fresnel * 0.4;

  // Combined alpha
  float alpha = clamp(fillAlpha + glowAlpha, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

/** Fragment shader - medium quality version */
const fragmentShaderMedium = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform float uBorderRadius;
uniform float uEnergy;
uniform vec3 uEnergyColor;
uniform float uGlowBorders;
uniform float uAnimationSpeed;

varying vec2 vUv;

float roundedRectSDF(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

void main() {
  float animTime = uTime * uAnimationSpeed;
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  vec2 size = vec2(uAspect, 1.0) - uBorderRadius * 2.0;
  float d = roundedRectSDF(uv, size, uBorderRadius);

  float fill = 1.0 - smoothstep(-0.01, 0.01, d);
  vec3 glassColor = vec3(0.04, 0.02, 0.08);

  float borderGlow = 0.0;
  if (uGlowBorders > 0.5) {
    float borderDist = abs(d);
    borderGlow = exp(-borderDist * 30.0) * uEnergy * 0.6;
  }

  vec3 finalColor = glassColor + uEnergyColor * borderGlow;
  float alpha = fill * 0.15 + borderGlow * 0.5;

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// =============================================================================
// SHADER CREATION
// =============================================================================

/**
 * Create enhanced glass shader uniforms
 */
export function createEnhancedGlassUniforms(config: EnhancedGlassConfig = {}): EnhancedGlassUniforms {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const energyColors = ENERGY_COLORS[mergedConfig.energyState];
  const primaryColor = config.energyColor
    ? new Color(config.energyColor)
    : energyColors.primary;

  return {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uResolution: { value: new Vector2(1, 1) },
    uBorderRadius: { value: mergedConfig.borderRadius },
    uBlurIntensity: { value: mergedConfig.blurIntensity },
    uEnergy: { value: ENERGY_VALUES[mergedConfig.energyState] },
    uEnergyColor: { value: primaryColor },
    uEnergyColorSecondary: { value: energyColors.secondary },
    uGlowBorders: { value: mergedConfig.glowBorders ? 1.0 : 0.0 },
    uDepth: { value: mergedConfig.depth },
    uFresnelIntensity: { value: mergedConfig.fresnelIntensity },
    uNoiseIntensity: { value: mergedConfig.noiseIntensity },
    uAnimationSpeed: { value: mergedConfig.animationSpeed },
    uQualityTier: { value: QUALITY_VALUES[mergedConfig.quality] },
  };
}

/**
 * Create enhanced glass shader material
 */
export function createEnhancedGlassShader(config: EnhancedGlassConfig = {}): ShaderMaterial {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const uniforms = createEnhancedGlassUniforms(config);

  // Select fragment shader based on quality
  const fragmentShader = mergedConfig.quality === 'high' || mergedConfig.quality === 'medium'
    ? fragmentShaderHigh
    : fragmentShaderMedium;

  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Update shader for animation frame
 */
export function updateEnhancedGlassShader(
  material: ShaderMaterial,
  delta: number,
  options?: {
    resolution?: { width: number; height: number };
    aspect?: number;
    energyState?: GlassEnergyState;
  }
): void {
  const uniforms = material.uniforms as unknown as EnhancedGlassUniforms;

  // Update time
  uniforms.uTime.value += delta;

  // Update resolution if provided
  if (options?.resolution) {
    uniforms.uResolution.value.set(options.resolution.width, options.resolution.height);
  }

  // Update aspect ratio if provided
  if (options?.aspect !== undefined) {
    uniforms.uAspect.value = options.aspect;
  }

  // Smoothly transition energy state if provided
  if (options?.energyState) {
    const targetEnergy = ENERGY_VALUES[options.energyState];
    uniforms.uEnergy.value += (targetEnergy - uniforms.uEnergy.value) * 0.1;

    // Update colors
    const colors = ENERGY_COLORS[options.energyState];
    uniforms.uEnergyColor.value.lerp(colors.primary, 0.1);
    uniforms.uEnergyColorSecondary.value.lerp(colors.secondary, 0.1);
  }
}

/**
 * Set energy state on shader
 */
export function setEnhancedGlassEnergy(
  material: ShaderMaterial,
  energyState: GlassEnergyState
): void {
  const uniforms = material.uniforms as unknown as EnhancedGlassUniforms;
  uniforms.uEnergy.value = ENERGY_VALUES[energyState];
  const colors = ENERGY_COLORS[energyState];
  uniforms.uEnergyColor.value.copy(colors.primary);
  uniforms.uEnergyColorSecondary.value.copy(colors.secondary);
}

/**
 * Dispose shader material
 */
export function disposeEnhancedGlassShader(material: ShaderMaterial): void {
  material.dispose();
}

export default createEnhancedGlassShader;
