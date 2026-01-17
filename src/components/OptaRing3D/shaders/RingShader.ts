/**
 * Ring Shader - Glassmorphism Fresnel Shader for Opta Ring
 *
 * Phase 25: Implements premium glass material with:
 * - 25-01: Fresnel rim lighting based on view angle
 * - 25-02: Energy glow uniform (0-1) affecting emissive intensity
 * - 25-03: Inner light scattering simulation (fake SSS)
 * - 25-04: Color temperature shift based on state (cool dormant -> hot active)
 *
 * The shader creates a premium obsidian glass look that responds
 * dynamically to the ring's state and energy level.
 *
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 * @see OPTA_RING_ANIMATION_SPEC.md - Ring state definitions
 */

import { ShaderMaterial, Color, FrontSide } from 'three';
// AdditiveBlending reserved for future particle integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AdditiveBlending as _AdditiveBlending } from 'three';
import type { Uniform } from '@/lib/shaders/types';
import { cssToThreeColor } from '@/lib/shaders/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Ring state for color temperature mapping
 * Matches extended RingState from types.ts
 */
export type RingShaderState =
  | 'dormant'
  | 'waking'
  | 'active'
  | 'sleeping'
  | 'processing'
  | 'exploding'
  | 'recovering';

/**
 * Ring shader uniform configuration
 */
export interface RingShaderUniforms {
  /** Index signature for Three.js ShaderMaterial compatibility */
  [key: string]: Uniform<unknown>;
  /** Animation time */
  uTime: Uniform<number>;
  /** Energy level 0-1 (controls glow intensity and fresnel power) */
  uEnergyLevel: Uniform<number>;
  /** Inner glow intensity 0-1 (subsurface scattering simulation) */
  uInnerGlow: Uniform<number>;
  /** Fresnel power exponent (higher = tighter rim glow) */
  uFresnelPower: Uniform<number>;
  /** Fresnel bias (minimum fresnel contribution) */
  uFresnelBias: Uniform<number>;
  /** Base color (dormant state) */
  uColorDormant: Uniform<Color>;
  /** Active color (active state) */
  uColorActive: Uniform<Color>;
  /** Explode color (white-hot core) */
  uColorExplode: Uniform<Color>;
  /** State interpolation 0-1 (0=dormant, 1=active/exploding) */
  uStateBlend: Uniform<number>;
  /** Is exploding (for white-hot effect) */
  uExploding: Uniform<number>;
  /** Processing pulse phase */
  uPulsePhase: Uniform<number>;
}

/**
 * Configuration options for ring shader
 */
export interface RingShaderConfig {
  /** Initial energy level */
  energyLevel?: number;
  /** Initial inner glow */
  innerGlow?: number;
  /** Fresnel power exponent */
  fresnelPower?: number;
  /** Initial state */
  state?: RingShaderState;
}

// =============================================================================
// COLOR CONSTANTS (from Design System)
// =============================================================================

/**
 * Ring colors from design system
 * Dormant: deep purple #3B1D5A (cool)
 * Active: electric violet #9333EA (warm)
 * Exploding: white-hot with purple edge
 */
export const RING_COLORS = {
  dormant: '#3B1D5A',      // Deep purple (cool) - hsl(265, 50%, 23%)
  active: '#9333EA',       // Electric violet (warm) - hsl(265, 90%, 55%)
  explode: '#FFFFFF',      // White-hot core
  rim: '#A855F7',          // Purple rim for explosion - hsl(270, 91%, 65%)
} as const;

// =============================================================================
// VERTEX SHADER
// =============================================================================

/**
 * Vertex shader for ring with fresnel calculation
 * Passes world normal and view direction to fragment shader
 */
const ringVertexShader = /* glsl */ `
precision highp float;

// Varyings to fragment shader
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  // Transform normal to world space
  vNormal = normalize(normalMatrix * normal);

  // Calculate world position
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // Calculate view direction (from surface to camera)
  vViewDir = normalize(cameraPosition - worldPosition.xyz);

  // Pass UV for potential texture mapping
  vUv = uv;

  // Standard position transform
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// =============================================================================
// FRAGMENT SHADER
// =============================================================================

/**
 * Fragment shader implementing:
 * - Fresnel rim lighting
 * - Energy-driven emissive
 * - Subsurface scattering simulation
 * - State-based color temperature
 */
const ringFragmentShader = /* glsl */ `
precision highp float;

// Uniforms
uniform float uTime;
uniform float uEnergyLevel;
uniform float uInnerGlow;
uniform float uFresnelPower;
uniform float uFresnelBias;
uniform vec3 uColorDormant;
uniform vec3 uColorActive;
uniform vec3 uColorExplode;
uniform float uStateBlend;
uniform float uExploding;
uniform float uPulsePhase;

// Varyings from vertex shader
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Constants
const float PI = 3.14159265359;

// =============================================================================
// FRESNEL EFFECT (25-01)
// =============================================================================

/**
 * Calculate fresnel factor based on view angle
 * Edges glow more than faces pointing at camera
 *
 * @param normal - Surface normal (normalized)
 * @param viewDir - View direction (normalized)
 * @param power - Fresnel exponent (higher = tighter rim)
 * @param bias - Minimum fresnel contribution
 */
float calculateFresnel(vec3 normal, vec3 viewDir, float power, float bias) {
  float NdotV = max(0.0, dot(normal, viewDir));
  float fresnel = pow(1.0 - NdotV, power);
  return clamp(fresnel + bias, 0.0, 1.0);
}

// =============================================================================
// ENERGY GLOW (25-02)
// =============================================================================

/**
 * Calculate emissive intensity based on energy level
 * More energy = stronger emissive glow
 *
 * @param energyLevel - 0-1 energy amount
 * @param baseEmissive - Minimum emissive (always visible)
 */
float calculateEmissiveIntensity(float energyLevel, float baseEmissive) {
  // Formula: emissive * (0.3 + energyLevel * 0.7)
  // At 0 energy: 0.3 base emissive
  // At 1 energy: 1.0 full emissive
  return baseEmissive * (0.3 + energyLevel * 0.7);
}

/**
 * Calculate fresnel power modulation by energy
 * Higher energy = stronger rim glow (lower power = wider spread)
 */
float calculateEnergyFresnelPower(float basePower, float energyLevel) {
  // More energy = lower power = wider fresnel rim
  // Range: basePower at 0 energy, basePower * 0.5 at full energy
  return basePower * (1.0 - energyLevel * 0.5);
}

// =============================================================================
// SUBSURFACE SCATTERING SIMULATION (25-03)
// =============================================================================

/**
 * Fake subsurface scattering using backlight contribution
 * Simulates light passing through translucent material
 *
 * @param normal - Surface normal
 * @param viewDir - View direction
 * @param lightDir - Dominant light direction
 * @param innerGlow - Inner glow intensity
 */
float calculateSSS(vec3 normal, vec3 viewDir, vec3 lightDir, float innerGlow) {
  // Back-facing light contribution (wrap lighting)
  float backLight = max(0.0, dot(-normal, lightDir));
  backLight = pow(backLight, 2.0); // Square for falloff

  // View-dependent transmission
  float viewTransmission = max(0.0, dot(-viewDir, lightDir));
  viewTransmission = pow(viewTransmission, 1.5);

  // Combine for SSS approximation
  float sss = (backLight * 0.6 + viewTransmission * 0.4) * innerGlow;

  // Add depth/thickness estimation (thinner at edges)
  float thickness = 1.0 - pow(1.0 - abs(dot(normal, viewDir)), 0.5);
  sss *= (0.3 + thickness * 0.7);

  return sss;
}

// =============================================================================
// COLOR TEMPERATURE (25-04)
// =============================================================================

/**
 * Blend between dormant (cool) and active (warm) colors
 *
 * @param dormant - Cool/dormant color
 * @param active - Warm/active color
 * @param explode - White-hot explosion color
 * @param stateBlend - 0-1 interpolation (0=dormant, 1=active)
 * @param exploding - 0-1 explosion amount
 */
vec3 calculateStateColor(vec3 dormant, vec3 active, vec3 explode, float stateBlend, float exploding) {
  // Base blend between dormant and active
  vec3 baseColor = mix(dormant, active, stateBlend);

  // For explosion: blend toward white-hot core
  if (exploding > 0.0) {
    // White-hot center, colored edge
    baseColor = mix(baseColor, explode, exploding * 0.8);
  }

  return baseColor;
}

/**
 * Processing pulse animation
 * Oscillates between dormant and active colors
 */
float calculatePulse(float phase, float time) {
  // Smooth sine wave oscillation
  float pulse = sin(time * 2.0 + phase * PI * 2.0) * 0.5 + 0.5;
  return pulse;
}

// =============================================================================
// MAIN SHADER
// =============================================================================

void main() {
  // Normalize interpolated varyings
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);

  // Simulated key light direction (upper right, slightly behind)
  vec3 lightDir = normalize(vec3(0.5, 0.5, -0.3));

  // ==========================================================================
  // FRESNEL CALCULATION (25-01)
  // ==========================================================================

  // Modulate fresnel power by energy level
  float fresnelPower = calculateEnergyFresnelPower(uFresnelPower, uEnergyLevel);
  float fresnel = calculateFresnel(normal, viewDir, fresnelPower, uFresnelBias);

  // ==========================================================================
  // COLOR TEMPERATURE (25-04)
  // ==========================================================================

  // Calculate state blend with processing pulse
  float stateBlend = uStateBlend;
  if (uPulsePhase > 0.0) {
    // Processing state: pulse between dormant and active
    float pulse = calculatePulse(uPulsePhase, uTime);
    stateBlend = pulse;
  }

  // Get base color for current state
  vec3 baseColor = calculateStateColor(
    uColorDormant,
    uColorActive,
    uColorExplode,
    stateBlend,
    uExploding
  );

  // ==========================================================================
  // EMISSIVE INTENSITY (25-02)
  // ==========================================================================

  float emissiveIntensity = calculateEmissiveIntensity(uEnergyLevel, 1.0);

  // Fresnel-enhanced emissive (rim glows more)
  vec3 rimEmissive = baseColor * fresnel * emissiveIntensity * 1.5;

  // ==========================================================================
  // SUBSURFACE SCATTERING (25-03)
  // ==========================================================================

  float sss = calculateSSS(normal, viewDir, lightDir, uInnerGlow);
  vec3 sssColor = uColorActive * sss * 0.8; // Use active color for inner glow

  // ==========================================================================
  // SURFACE SHADING
  // ==========================================================================

  // Base diffuse (lambert)
  float diffuse = max(0.0, dot(normal, lightDir));
  diffuse = diffuse * 0.5 + 0.5; // Half-lambert wrap for softer falloff

  // Specular highlight (blinn-phong)
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(0.0, dot(normal, halfDir)), 32.0);

  // Ambient occlusion simulation (darker in concave areas)
  float ao = 1.0 - fresnel * 0.3;

  // ==========================================================================
  // COMBINE ALL EFFECTS
  // ==========================================================================

  // Surface contribution
  vec3 surfaceColor = baseColor * diffuse * ao;

  // Add specular
  surfaceColor += vec3(1.0) * specular * 0.4 * (1.0 + uEnergyLevel);

  // Add rim emissive (fresnel glow)
  surfaceColor += rimEmissive;

  // Add subsurface scattering
  surfaceColor += sssColor;

  // Explosion boost: additional additive glow
  if (uExploding > 0.0) {
    float explosionGlow = fresnel * uExploding;
    surfaceColor += uColorActive * explosionGlow * 2.0;
  }

  // Clamp to prevent over-saturation
  surfaceColor = clamp(surfaceColor, 0.0, 2.0);

  // Final output with slight alpha for glass feel
  float alpha = 0.95 + fresnel * 0.05;

  gl_FragColor = vec4(surfaceColor, alpha);
}
`;

// =============================================================================
// SHADER CREATION FUNCTIONS
// =============================================================================

/**
 * Default ring shader configuration
 */
const defaultRingConfig: Required<RingShaderConfig> = {
  energyLevel: 0,
  innerGlow: 0.3,
  fresnelPower: 3.0,
  state: 'dormant',
};

/**
 * Create ring shader uniforms with default values
 */
export function createRingShaderUniforms(config: RingShaderConfig = {}): RingShaderUniforms {
  const mergedConfig = { ...defaultRingConfig, ...config };

  // Calculate state blend from initial state
  let stateBlend = 0;
  let exploding = 0;
  let pulsePhase = 0;

  switch (mergedConfig.state) {
    case 'dormant':
      stateBlend = 0;
      break;
    case 'waking':
      stateBlend = 0.3;
      break;
    case 'active':
      stateBlend = 1;
      break;
    case 'sleeping':
      stateBlend = 0.3;
      break;
    case 'processing':
      stateBlend = 0.5;
      pulsePhase = 1; // Enable pulsing
      break;
    case 'exploding':
      stateBlend = 1;
      exploding = 1;
      break;
    case 'recovering':
      stateBlend = 0.7;
      exploding = 0.3;
      break;
  }

  return {
    uTime: { value: 0 },
    uEnergyLevel: { value: mergedConfig.energyLevel },
    uInnerGlow: { value: mergedConfig.innerGlow },
    uFresnelPower: { value: mergedConfig.fresnelPower },
    uFresnelBias: { value: 0.1 },
    uColorDormant: { value: cssToThreeColor(RING_COLORS.dormant) },
    uColorActive: { value: cssToThreeColor(RING_COLORS.active) },
    uColorExplode: { value: cssToThreeColor(RING_COLORS.explode) },
    uStateBlend: { value: stateBlend },
    uExploding: { value: exploding },
    uPulsePhase: { value: pulsePhase },
  };
}

/**
 * Create the ring glassmorphism shader material
 *
 * @param config - Optional configuration
 * @returns Three.js ShaderMaterial with ring effect
 *
 * @example
 * ```tsx
 * const material = createRingShader({ energyLevel: 0.5, state: 'active' });
 *
 * // In animation loop:
 * material.uniforms.uTime.value = clock.getElapsedTime();
 * material.uniforms.uEnergyLevel.value = currentEnergy;
 * ```
 */
export function createRingShader(config: RingShaderConfig = {}): ShaderMaterial {
  const uniforms = createRingShaderUniforms(config);

  return new ShaderMaterial({
    uniforms,
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
  });
}

// =============================================================================
// SHADER UPDATE FUNCTIONS
// =============================================================================

/**
 * Update ring shader uniforms for animation
 *
 * @param material - The ring shader material
 * @param delta - Time delta (seconds)
 */
export function updateRingShader(material: ShaderMaterial, delta: number): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uTime.value += delta;
}

/**
 * Set the energy level uniform
 *
 * @param material - The ring shader material
 * @param energyLevel - Energy level 0-1
 */
export function setRingEnergy(material: ShaderMaterial, energyLevel: number): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uEnergyLevel.value = Math.max(0, Math.min(1, energyLevel));
}

/**
 * Set the inner glow intensity
 *
 * @param material - The ring shader material
 * @param innerGlow - Inner glow 0-1
 */
export function setRingInnerGlow(material: ShaderMaterial, innerGlow: number): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uInnerGlow.value = Math.max(0, Math.min(1, innerGlow));
}

/**
 * Set the ring state for color temperature
 *
 * @param material - The ring shader material
 * @param state - Ring state
 */
export function setRingState(material: ShaderMaterial, state: RingShaderState): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;

  switch (state) {
    case 'dormant':
      uniforms.uStateBlend.value = 0;
      uniforms.uExploding.value = 0;
      uniforms.uPulsePhase.value = 0;
      break;
    case 'waking':
      uniforms.uStateBlend.value = 0.3;
      uniforms.uExploding.value = 0;
      uniforms.uPulsePhase.value = 0;
      break;
    case 'active':
      uniforms.uStateBlend.value = 1;
      uniforms.uExploding.value = 0;
      uniforms.uPulsePhase.value = 0;
      break;
    case 'sleeping':
      // Transitioning back to dormant - reverse of waking
      uniforms.uStateBlend.value = 0.3;
      uniforms.uExploding.value = 0;
      uniforms.uPulsePhase.value = 0;
      break;
    case 'processing':
      uniforms.uStateBlend.value = 0.5;
      uniforms.uExploding.value = 0;
      uniforms.uPulsePhase.value = 1; // Enable pulsing
      break;
    case 'exploding':
      uniforms.uStateBlend.value = 1;
      uniforms.uExploding.value = 1;
      uniforms.uPulsePhase.value = 0;
      break;
    case 'recovering':
      // Post-explosion cooldown - fading from explosion
      uniforms.uStateBlend.value = 0.7;
      uniforms.uExploding.value = 0.3; // Fading explosion
      uniforms.uPulsePhase.value = 0;
      break;
  }
}

/**
 * Set custom colors for the ring shader
 *
 * @param material - The ring shader material
 * @param colors - Color overrides
 */
export function setRingColors(
  material: ShaderMaterial,
  colors: Partial<{
    dormant: string;
    active: string;
    explode: string;
  }>
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;

  if (colors.dormant) {
    uniforms.uColorDormant.value = cssToThreeColor(colors.dormant);
  }
  if (colors.active) {
    uniforms.uColorActive.value = cssToThreeColor(colors.active);
  }
  if (colors.explode) {
    uniforms.uColorExplode.value = cssToThreeColor(colors.explode);
  }
}

/**
 * Set fresnel parameters
 *
 * @param material - The ring shader material
 * @param power - Fresnel power exponent
 * @param bias - Fresnel bias (minimum contribution)
 */
export function setRingFresnel(
  material: ShaderMaterial,
  power: number,
  bias?: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uFresnelPower.value = power;
  if (bias !== undefined) {
    uniforms.uFresnelBias.value = bias;
  }
}

/**
 * Dispose ring shader material and free GPU resources
 */
export function disposeRingShader(material: ShaderMaterial): void {
  material.dispose();
}

// =============================================================================
// PRESETS
// =============================================================================

/**
 * Shader presets for common ring states
 */
export const ringShaderPresets = {
  /** Default dormant state - cool, minimal glow */
  dormant: {
    energyLevel: 0,
    innerGlow: 0.2,
    fresnelPower: 3.5,
    state: 'dormant' as const,
  },
  /** Active state - warm, visible energy */
  active: {
    energyLevel: 0.6,
    innerGlow: 0.5,
    fresnelPower: 2.5,
    state: 'active' as const,
  },
  /** Processing state - pulsing between states */
  processing: {
    energyLevel: 0.4,
    innerGlow: 0.4,
    fresnelPower: 3.0,
    state: 'processing' as const,
  },
  /** Exploding state - maximum energy, white-hot */
  exploding: {
    energyLevel: 1.0,
    innerGlow: 1.0,
    fresnelPower: 2.0,
    state: 'exploding' as const,
  },
} as const;

export type RingShaderPreset = keyof typeof ringShaderPresets;

/**
 * Create ring shader from preset
 */
export function createRingShaderFromPreset(preset: RingShaderPreset): ShaderMaterial {
  return createRingShader(ringShaderPresets[preset]);
}
