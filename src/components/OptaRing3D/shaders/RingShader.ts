/**
 * Ring Shader - Glassmorphism Fresnel Shader for Opta Ring
 *
 * Phase 25: Implements premium glass material with:
 * - 25-01: Fresnel rim lighting based on view angle
 * - 25-02: Energy glow uniform (0-1) affecting emissive intensity
 * - 25-03: Inner light scattering simulation (fake SSS)
 * - 25-04: Color temperature shift based on state (cool dormant -> hot active)
 *
 * Phase 41.2: Internal Plasma Core
 * - Swirling energy clouds inside the ring via FBM + domain warping
 * - Organic movement that feels alive and natural
 * - Depth illusion via fresnel - plasma appears inside glass
 * - Energy-driven speed and color transformation
 *
 * Phase 41.3: Obsidian Mirror Effect
 * - Dark reflective obsidian surface treatment on ring exterior
 * - Subtle environment reflections using procedural reflection mapping
 * - Polished mirror quality with sharp, moving specular highlights
 * - View-angle dependent reflection intensity (fresnel-based reflectivity)
 *
 * Phase 41.4: Energy Contrast System
 * - Dramatic fresnel contrast between dormant and active states
 * - Dormant: nearly invisible with minimal, tight rim lighting
 * - Active: bright, energetic rim glow that commands attention
 * - Smooth interpolation between states driven by energy uniform
 * - uDormantFresnelPower: high value (8.0) for tight, minimal rim
 * - uActiveFresnelPower: low value (1.5) for wide, dramatic rim
 * - uDormantRimIntensity: very low (0.15) for near-invisibility
 * - uActiveRimIntensity: high (2.5) for bright, energetic glow
 *
 * Phase 41.6: Suspenseful Transitions
 * - Easing-based transition curves for smooth energy changes
 * - Suspenseful ramp-up effect before full activation (anticipation pulse)
 * - Subtle pulsing during transition states building toward climax
 * - Graceful power-down sequence with lingering afterglow
 * - uTransitionProgress: 0-1 progress through current transition
 * - uTransitionType: 0=none, 1=power-up, 2=power-down
 * - uPreviousEnergy: energy level at start of transition (for afterglow)
 * - uAnticipationIntensity: controls pre-activation pulse strength
 *
 * Phase 41.7: Color Temperature Mastery
 * - Dormant state is colorless dark obsidian (grayscale/desaturated)
 * - Active state has vibrant purple plasma with warm color temperature
 * - Smooth color interpolation from cold/gray to warm/purple based on energy
 * - Plasma interior shifts from dark smoldering to bright violet glow
 * - uColorSaturation: energy-driven saturation (0=grayscale, 1=full color)
 * - uColorWarmth: color temperature shift (0=cold/neutral, 1=warm/vibrant)
 *
 * Phase 41.8: Reference Image Parity
 * - Dormant state tuned to match 0%Opta.png: near-black obsidian with faint purple rim
 * - Active state tuned to match 50%Opta.png: vibrant purple plasma with magenta hotspots
 * - Plasma colors shifted toward magenta-violet for reference intensity
 * - Fresnel and rim values calibrated for visual parity
 *
 * The shader creates a premium obsidian glass look that responds
 * dynamically to the ring's state and energy level, with internal
 * plasma that tells the energy story at a glance.
 *
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 * @see OPTA_RING_ANIMATION_SPEC.md - Ring state definitions
 * @see 41.2-RESEARCH.md - FBM and domain warping techniques
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
  /** Obsidian mirror reflectivity 0-1 (41.3) */
  uMirrorReflectivity: Uniform<number>;
  /** Environment reflection intensity 0-1 (41.3) */
  uEnvReflectionIntensity: Uniform<number>;
  /** Specular sharpness for mirror highlights (41.3) */
  uSpecularSharpness: Uniform<number>;
  /** Fresnel power for dormant state - high = tight rim (41.4) */
  uDormantFresnelPower: Uniform<number>;
  /** Fresnel power for active state - low = wide rim (41.4) */
  uActiveFresnelPower: Uniform<number>;
  /** Rim intensity multiplier for dormant state - low = nearly invisible (41.4) */
  uDormantRimIntensity: Uniform<number>;
  /** Rim intensity multiplier for active state - high = bright glow (41.4) */
  uActiveRimIntensity: Uniform<number>;
  /** Transition progress 0-1 (41.6) */
  uTransitionProgress: Uniform<number>;
  /** Transition type: 0=none, 1=power-up, 2=power-down (41.6) */
  uTransitionType: Uniform<number>;
  /** Previous energy level at transition start - for afterglow (41.6) */
  uPreviousEnergy: Uniform<number>;
  /** Anticipation pulse intensity 0-1 (41.6) */
  uAnticipationIntensity: Uniform<number>;
  /** Color saturation 0-1: 0=grayscale, 1=full vibrant color (41.7) */
  uColorSaturation: Uniform<number>;
  /** Color warmth/temperature 0-1: 0=cold/neutral, 1=warm/vibrant (41.7) */
  uColorWarmth: Uniform<number>;
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
  /** Obsidian mirror reflectivity 0-1 (41.3) */
  mirrorReflectivity?: number;
  /** Environment reflection intensity 0-1 (41.3) */
  envReflectionIntensity?: number;
  /** Specular sharpness for mirror highlights (41.3) */
  specularSharpness?: number;
  /** Fresnel power for dormant state - high = tight rim (41.4) */
  dormantFresnelPower?: number;
  /** Fresnel power for active state - low = wide rim (41.4) */
  activeFresnelPower?: number;
  /** Rim intensity multiplier for dormant state - low = nearly invisible (41.4) */
  dormantRimIntensity?: number;
  /** Rim intensity multiplier for active state - high = bright glow (41.4) */
  activeRimIntensity?: number;
  /** Anticipation pulse intensity for power-up transitions 0-1 (41.6) */
  anticipationIntensity?: number;
  /** Base color saturation at full energy 0-1 (41.7) */
  colorSaturation?: number;
  /** Base color warmth/temperature at full energy 0-1 (41.7) */
  colorWarmth?: number;
}

// =============================================================================
// COLOR CONSTANTS (from Design System)
// =============================================================================

/**
 * Ring colors from design system - Phase 41.8: Tuned for reference image parity
 * Dormant: near-black obsidian with subtle purple tint (matching 0%Opta.png)
 * Active: vibrant magenta-violet (matching 50%Opta.png intensity)
 * Exploding: white-hot with purple edge
 */
export const RING_COLORS = {
  dormant: '#1A0D28',      // Near-black obsidian (matching reference - very dark purple-black)
  active: '#A855F7',       // Bright violet-magenta (matching 50%Opta.png intensity)
  explode: '#FFFFFF',      // White-hot core
  rim: '#C084FC',          // Brighter purple rim (matching reference intensity)
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
 * - Internal plasma core (Phase 41.2)
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
// Phase 41.3: Obsidian Mirror
uniform float uMirrorReflectivity;
uniform float uEnvReflectionIntensity;
uniform float uSpecularSharpness;
// Phase 41.4: Energy Contrast System
uniform float uDormantFresnelPower;
uniform float uActiveFresnelPower;
uniform float uDormantRimIntensity;
uniform float uActiveRimIntensity;
// Phase 41.6: Suspenseful Transitions
uniform float uTransitionProgress;
uniform float uTransitionType;     // 0=none, 1=power-up, 2=power-down
uniform float uPreviousEnergy;
uniform float uAnticipationIntensity;
// Phase 41.7: Color Temperature Mastery
uniform float uColorSaturation;    // 0=grayscale, 1=full color
uniform float uColorWarmth;        // 0=cold/neutral, 1=warm/vibrant

// Varyings from vertex shader
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Constants
const float PI = 3.14159265359;

// =============================================================================
// SIMPLEX NOISE (41.2 - from Patricio Gonzalez Vivo)
// =============================================================================

/**
 * Permutation polynomial for simplex noise
 * Source: Ashima Arts (https://github.com/ashima/webgl-noise)
 */
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

/**
 * 3D Simplex noise - organic, isotropic noise
 * Returns value in range [-1, 1]
 */
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalize gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix contributions
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// =============================================================================
// FRACTAL BROWNIAN MOTION (41.2)
// =============================================================================

/**
 * FBM - layered noise for organic complexity
 * 5 octaves provides good detail without excessive cost
 */
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;   // lacunarity
    amplitude *= 0.5;   // gain/persistence
  }

  return value;
}

// =============================================================================
// PLASMA GENERATION (41.2)
// =============================================================================

/**
 * Internal plasma effect with domain warping
 * Creates organic, cloud-like swirling energy
 *
 * @param p - 3D position (UV + time offset)
 * @param energy - 0-1 energy level
 * @return plasma intensity 0-1
 */
float plasma(vec3 p, float energy) {
  // Domain warp for organic movement
  vec3 warp = vec3(
    snoise(p * 2.0),
    snoise(p * 2.0 + vec3(5.2, 1.3, 2.1)),
    snoise(p * 2.0 + vec3(9.7, 4.1, 6.8))
  );

  // Warp strength increases with energy
  float warpStrength = mix(0.3, 0.6, energy);
  vec3 warpedPos = p + warp * warpStrength;

  // FBM on warped coordinates
  float n = fbm(warpedPos);

  // Normalize to 0-1 range
  return n * 0.5 + 0.5;
}

/**
 * Calculate plasma color based on energy level with color temperature mastery
 * Phase 41.8: Tuned for reference image parity
 *
 * Dormant (0%Opta.png): near-black obsidian with barely visible purple tint
 * Active (50%Opta.png): vibrant magenta-purple plasma with bright hotspots
 * Max: bright violet-white glow (intense, hot)
 *
 * Phase 41.7: Uses energy-driven saturation and warmth
 */
vec3 getPlasmaColor(float energy) {
  // Phase 41.8: Base colors tuned to match reference images
  // 0%Opta.png: Nearly pure black obsidian - extremely dark
  vec3 dormantBase = vec3(0.02, 0.015, 0.03);   // Near-black obsidian (darker than before)

  // 50%Opta.png: Vibrant magenta-purple plasma with visible swirls
  vec3 activeBase = vec3(0.5, 0.1, 0.85);       // Shifted toward magenta-violet

  // Maximum energy: bright violet-white hotspots
  vec3 maxBase = vec3(0.9, 0.6, 1.0);           // Bright magenta-white

  // Interpolate base color with enhanced curve for reference parity
  vec3 baseColor;
  if (energy < 0.4) {
    // Dormant to early active: slow transition, stay dark longer
    float t = energy / 0.4;
    t = t * t; // Quadratic ease-in to stay dark longer
    baseColor = mix(dormantBase, activeBase * 0.5, t);
  } else if (energy < 0.7) {
    // Mid-active: rapid color emergence (matching 50%Opta.png)
    float t = (energy - 0.4) / 0.3;
    baseColor = mix(activeBase * 0.5, activeBase, t);
  } else {
    // High energy to max: transition to bright violet
    float t = (energy - 0.7) / 0.3;
    baseColor = mix(activeBase, maxBase, t);
  }

  // Apply color temperature transformation based on energy
  // Low energy = cold, desaturated obsidian
  // High energy = warm, vibrant purple
  vec3 result = applyEnergyColorTemperature(baseColor, energy, uColorSaturation, uColorWarmth);

  return result;
}

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
 * Calculate fresnel power modulation by energy (41.4 Energy Contrast System)
 * Interpolates between dormant (tight, subtle) and active (wide, dramatic)
 *
 * @param dormantPower - High value for tight rim when dormant (e.g., 8.0)
 * @param activePower - Low value for wide rim when active (e.g., 1.5)
 * @param energyLevel - 0-1 energy amount
 */
float calculateEnergyFresnelPower(float dormantPower, float activePower, float energyLevel) {
  // Smooth interpolation: dormant (high power, tight) -> active (low power, wide)
  // Use smoothstep for more natural transition
  float t = smoothstep(0.0, 1.0, energyLevel);
  return mix(dormantPower, activePower, t);
}

/**
 * Calculate rim intensity modulation by energy (41.4 Energy Contrast System)
 * Creates dramatic visibility contrast between dormant and active states
 *
 * @param dormantIntensity - Very low for near-invisibility (e.g., 0.15)
 * @param activeIntensity - High for bright glow (e.g., 2.5)
 * @param energyLevel - 0-1 energy amount
 */
float calculateEnergyRimIntensity(float dormantIntensity, float activeIntensity, float energyLevel) {
  // Use smoothstep for natural easing - more dramatic at high energy
  float t = smoothstep(0.0, 1.0, energyLevel);
  // Apply slight exponential curve for more dramatic contrast
  t = t * t * (3.0 - 2.0 * t); // Hermite smoothstep for extra smoothness
  return mix(dormantIntensity, activeIntensity, t);
}

// =============================================================================
// SUSPENSEFUL TRANSITIONS (41.6)
// =============================================================================

/**
 * Ease-in-out-back curve for dramatic transitions
 * Creates overshoot effect at end for impactful arrival
 *
 * @param t - Input progress 0-1
 * @return Eased value with slight overshoot
 */
float easeInOutBack(float t) {
  float c1 = 1.70158;
  float c2 = c1 * 1.525;

  if (t < 0.5) {
    return (pow(2.0 * t, 2.0) * ((c2 + 1.0) * 2.0 * t - c2)) / 2.0;
  } else {
    return (pow(2.0 * t - 2.0, 2.0) * ((c2 + 1.0) * (t * 2.0 - 2.0) + c2) + 2.0) / 2.0;
  }
}

/**
 * Ease-out-expo for graceful power-down deceleration
 * Energy trails off naturally with lingering afterglow
 *
 * @param t - Input progress 0-1
 * @return Eased value with exponential deceleration
 */
float easeOutExpo(float t) {
  return t >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t);
}

/**
 * Ease-in-expo for building anticipation
 * Slow start that accelerates dramatically
 *
 * @param t - Input progress 0-1
 * @return Eased value with exponential acceleration
 */
float easeInExpo(float t) {
  return t <= 0.0 ? 0.0 : pow(2.0, 10.0 * t - 10.0);
}

/**
 * Calculate anticipation pulse during power-up ramp
 * Creates subtle pulsing that builds before full activation
 * Pulse frequency increases as transition progresses
 *
 * @param progress - Transition progress 0-1
 * @param time - Animation time
 * @param intensity - Base pulse intensity 0-1
 * @return Anticipation pulse contribution 0-1
 */
float calculateAnticipationPulse(float progress, float time, float intensity) {
  if (intensity <= 0.0 || progress >= 1.0) return 0.0;

  // Pulse is strongest in the middle of transition (0.3-0.7 range)
  float pulseWindow = smoothstep(0.1, 0.4, progress) * (1.0 - smoothstep(0.7, 0.95, progress));

  // Frequency increases as we approach activation
  float baseFreq = 3.0;
  float freqRamp = 1.0 + progress * 4.0; // 3Hz -> 15Hz
  float freq = baseFreq * freqRamp;

  // Pulse amplitude with subtle variation
  float pulse = sin(time * freq * PI * 2.0) * 0.5 + 0.5;

  // Add secondary faster pulse for complexity
  float pulse2 = sin(time * freq * 1.7 * PI * 2.0) * 0.5 + 0.5;
  pulse = mix(pulse, pulse2, 0.3);

  // Scale by window and intensity
  return pulse * pulseWindow * intensity * 0.4;
}

/**
 * Calculate afterglow effect during power-down
 * Creates lingering warmth that fades gracefully
 *
 * @param progress - Transition progress 0-1 (0=start of power-down)
 * @param previousEnergy - Energy level before power-down started
 * @return Afterglow contribution 0-1
 */
float calculateAfterglow(float progress, float previousEnergy) {
  if (previousEnergy <= 0.0) return 0.0;

  // Afterglow is strongest at the start, fades with exponential decay
  float decayRate = 3.0; // How quickly afterglow fades
  float glow = previousEnergy * exp(-progress * decayRate);

  // Add subtle pulsing during decay (dying ember effect)
  float emberPulse = sin(progress * PI * 4.0) * 0.1 + 0.9;
  glow *= emberPulse;

  return glow * 0.3; // Scale down to be subtle
}

/**
 * Apply transition easing to energy level
 * Different curves for power-up vs power-down
 *
 * @param currentEnergy - Current energy level 0-1
 * @param previousEnergy - Previous energy level 0-1
 * @param progress - Transition progress 0-1
 * @param transitionType - 0=none, 1=power-up, 2=power-down
 * @return Eased energy value
 */
float applyTransitionEasing(float currentEnergy, float previousEnergy, float progress, float transitionType) {
  if (transitionType < 0.5) {
    // No transition - return current energy
    return currentEnergy;
  }

  if (transitionType < 1.5) {
    // Power-up: ease-in-out-back for dramatic activation
    float easedProgress = easeInOutBack(progress);
    return mix(previousEnergy, currentEnergy, easedProgress);
  } else {
    // Power-down: ease-out-expo for graceful deceleration
    float easedProgress = easeOutExpo(progress);
    return mix(previousEnergy, currentEnergy, easedProgress);
  }
}

// =============================================================================
// COLOR TEMPERATURE MASTERY (41.7)
// =============================================================================

/**
 * Convert RGB to grayscale using luminance weights
 * Preserves perceived brightness when desaturating
 *
 * @param color - RGB color to convert
 * @return Grayscale value (luminance)
 */
float rgbToGrayscale(vec3 color) {
  // ITU-R BT.709 luminance coefficients
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Desaturate a color by a given amount
 * Smoothly blends from full color to grayscale
 *
 * @param color - Original RGB color
 * @param saturation - 0=grayscale, 1=original color
 * @return Desaturated color
 */
vec3 desaturateColor(vec3 color, float saturation) {
  float gray = rgbToGrayscale(color);
  return mix(vec3(gray), color, saturation);
}

/**
 * Apply color temperature shift
 * Cold colors shift toward blue-gray, warm toward purple-magenta
 *
 * @param color - Original RGB color
 * @param warmth - 0=cold/neutral, 1=warm/vibrant
 * @return Temperature-shifted color
 */
vec3 applyColorTemperature(vec3 color, float warmth) {
  // Cold bias: slight blue-gray tint
  vec3 coldTint = vec3(0.9, 0.92, 1.0);
  // Warm bias: purple-magenta warmth
  vec3 warmTint = vec3(1.1, 0.95, 1.15);

  vec3 temperatureTint = mix(coldTint, warmTint, warmth);
  return color * temperatureTint;
}

/**
 * Calculate energy-driven color saturation
 * Dormant = fully desaturated (obsidian gray)
 * Active = fully saturated (vibrant purple)
 *
 * @param energy - 0-1 energy level
 * @param baseSaturation - Maximum saturation at full energy
 * @return Saturation value 0-1
 */
float calculateEnergySaturation(float energy, float baseSaturation) {
  // Use smooth curve for natural transition
  // Desaturation is more aggressive at low energy
  float t = smoothstep(0.0, 0.8, energy);
  return t * baseSaturation;
}

/**
 * Calculate energy-driven color warmth
 * Dormant = cold, neutral gray
 * Active = warm, vibrant purple
 *
 * @param energy - 0-1 energy level
 * @param baseWarmth - Maximum warmth at full energy
 * @return Warmth value 0-1
 */
float calculateEnergyWarmth(float energy, float baseWarmth) {
  // Warmth ramps up faster than saturation for dramatic effect
  float t = smoothstep(0.0, 0.6, energy);
  return t * baseWarmth;
}

/**
 * Apply complete color temperature transformation
 * Combines desaturation and temperature shift based on energy
 *
 * @param color - Original RGB color
 * @param energy - 0-1 energy level
 * @param baseSaturation - Maximum saturation at full energy
 * @param baseWarmth - Maximum warmth at full energy
 * @return Transformed color
 */
vec3 applyEnergyColorTemperature(vec3 color, float energy, float baseSaturation, float baseWarmth) {
  float saturation = calculateEnergySaturation(energy, baseSaturation);
  float warmth = calculateEnergyWarmth(energy, baseWarmth);

  // First desaturate based on energy
  vec3 result = desaturateColor(color, saturation);

  // Then apply temperature shift
  result = applyColorTemperature(result, warmth);

  return result;
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
 * Phase 41.7: Now applies color temperature mastery
 *
 * @param dormant - Cool/dormant color (will be desaturated at low energy)
 * @param active - Warm/active color (vibrant at high energy)
 * @param explode - White-hot explosion color
 * @param stateBlend - 0-1 interpolation (0=dormant, 1=active)
 * @param exploding - 0-1 explosion amount
 * @param energy - Current energy level for color temperature
 */
vec3 calculateStateColor(vec3 dormant, vec3 active, vec3 explode, float stateBlend, float exploding, float energy) {
  // Base blend between dormant and active
  vec3 baseColor = mix(dormant, active, stateBlend);

  // Apply color temperature transformation based on energy (41.7)
  // Low energy = cold, desaturated obsidian gray
  // High energy = warm, vibrant purple
  baseColor = applyEnergyColorTemperature(baseColor, energy, uColorSaturation, uColorWarmth);

  // For explosion: blend toward white-hot core
  // Explosions are always fully saturated and hot
  if (exploding > 0.0) {
    // White-hot center, colored edge
    // Don't desaturate explosion colors
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
// OBSIDIAN MIRROR EFFECT (41.3)
// =============================================================================

/**
 * Generate procedural environment reflection
 * Creates fake environment map using view-dependent gradients
 * Simulates reflections without actual environment cubemap
 *
 * @param reflectDir - Reflection direction vector
 * @param time - Animation time for subtle movement
 * @return RGB color of fake environment reflection
 */
vec3 proceduralEnvReflection(vec3 reflectDir, float time) {
  // Normalize reflection direction
  vec3 rd = normalize(reflectDir);

  // Sky gradient (upper hemisphere) - subtle purple-blue gradient
  float skyGradient = smoothstep(-0.2, 0.8, rd.y);
  vec3 skyColor = mix(
    vec3(0.02, 0.01, 0.04),   // Dark purple-black horizon
    vec3(0.05, 0.02, 0.08)    // Slightly lighter zenith
  , skyGradient);

  // Ground reflection (lower hemisphere) - dark with subtle variation
  vec3 groundColor = vec3(0.01, 0.005, 0.015);

  // Blend sky and ground based on reflection Y
  vec3 envColor = rd.y > 0.0 ? skyColor : groundColor;

  // Add subtle light source reflections
  // Main light (upper right) - creates highlight streaks
  vec3 lightDir1 = normalize(vec3(0.6, 0.5, -0.4));
  float lightReflect1 = pow(max(0.0, dot(rd, lightDir1)), 64.0);
  envColor += vec3(0.15, 0.08, 0.2) * lightReflect1;

  // Secondary light (upper left) - dimmer accent
  vec3 lightDir2 = normalize(vec3(-0.5, 0.4, -0.3));
  float lightReflect2 = pow(max(0.0, dot(rd, lightDir2)), 48.0);
  envColor += vec3(0.08, 0.04, 0.12) * lightReflect2 * 0.5;

  // Add very subtle animated caustic-like variation
  float caustic = snoise(rd * 3.0 + vec3(time * 0.05, 0.0, 0.0));
  caustic = caustic * 0.5 + 0.5;
  envColor += vec3(0.02, 0.01, 0.03) * caustic * 0.3;

  return envColor;
}

/**
 * Calculate obsidian mirror reflection
 * Combines fresnel-based reflectivity with procedural environment
 *
 * @param normal - Surface normal
 * @param viewDir - View direction
 * @param reflectivity - Base mirror reflectivity (0-1)
 * @param envIntensity - Environment reflection strength
 * @param time - Animation time
 * @return RGB reflection contribution
 */
vec3 calculateObsidianReflection(
  vec3 normal,
  vec3 viewDir,
  float reflectivity,
  float envIntensity,
  float time
) {
  // Calculate reflection vector
  vec3 reflectDir = reflect(-viewDir, normal);

  // Fresnel-based reflection intensity (more reflective at glancing angles)
  float NdotV = max(0.0, dot(normal, viewDir));
  float fresnelReflect = pow(1.0 - NdotV, 4.0);

  // Combine base reflectivity with fresnel
  // Obsidian is highly reflective at edges, less so at center
  float reflectAmount = mix(reflectivity * 0.3, reflectivity, fresnelReflect);

  // Get procedural environment reflection
  vec3 envReflection = proceduralEnvReflection(reflectDir, time);

  // Apply reflection intensity and amount
  return envReflection * reflectAmount * envIntensity;
}

/**
 * Calculate sharp mirror specular highlight
 * Creates polished glass-like specular spots
 *
 * @param normal - Surface normal
 * @param viewDir - View direction
 * @param lightDir - Light direction
 * @param sharpness - Specular exponent (higher = sharper)
 * @return Specular intensity
 */
float calculateMirrorSpecular(
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float sharpness
) {
  // Blinn-Phong half vector
  vec3 halfDir = normalize(lightDir + viewDir);

  // Sharp specular with high exponent for mirror-like reflection
  float spec = pow(max(0.0, dot(normal, halfDir)), sharpness);

  // Add secondary broader specular for softer falloff
  float specBroad = pow(max(0.0, dot(normal, halfDir)), sharpness * 0.25);

  // Combine sharp core with soft halo
  return spec * 0.8 + specBroad * 0.2;
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
  // SUSPENSEFUL TRANSITIONS (41.6)
  // ==========================================================================

  // Apply transition easing to energy level for smooth, dramatic changes
  float effectiveEnergy = applyTransitionEasing(
    uEnergyLevel,
    uPreviousEnergy,
    uTransitionProgress,
    uTransitionType
  );

  // Calculate anticipation pulse (only during power-up transitions)
  float anticipation = 0.0;
  if (uTransitionType > 0.5 && uTransitionType < 1.5) {
    anticipation = calculateAnticipationPulse(
      uTransitionProgress,
      uTime,
      uAnticipationIntensity
    );
    // Add anticipation to effective energy for building tension
    effectiveEnergy = min(1.0, effectiveEnergy + anticipation);
  }

  // Calculate afterglow (only during power-down transitions)
  float afterglow = 0.0;
  if (uTransitionType > 1.5) {
    afterglow = calculateAfterglow(uTransitionProgress, uPreviousEnergy);
  }

  // ==========================================================================
  // FRESNEL CALCULATION (25-01 + 41.4 Energy Contrast System)
  // ==========================================================================

  // Phase 41.4: Energy-driven fresnel power interpolation
  // Dormant: high power (8.0) = tight, minimal rim
  // Active: low power (1.5) = wide, dramatic rim
  // Phase 41.6: Uses eased energy for smooth transitions
  float fresnelPower = calculateEnergyFresnelPower(
    uDormantFresnelPower,
    uActiveFresnelPower,
    effectiveEnergy
  );
  float fresnel = calculateFresnel(normal, viewDir, fresnelPower, uFresnelBias);

  // Phase 41.4: Energy-driven rim intensity for dramatic contrast
  // Dormant: very low intensity (0.15) = nearly invisible
  // Active: high intensity (2.5) = bright, energetic glow
  // Phase 41.6: Uses eased energy for smooth transitions
  float rimIntensityMultiplier = calculateEnergyRimIntensity(
    uDormantRimIntensity,
    uActiveRimIntensity,
    effectiveEnergy
  );

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

  // Get base color for current state (41.7: now includes color temperature)
  vec3 baseColor = calculateStateColor(
    uColorDormant,
    uColorActive,
    uColorExplode,
    stateBlend,
    uExploding,
    effectiveEnergy  // 41.7: Pass energy for color temperature calculation
  );

  // ==========================================================================
  // EMISSIVE INTENSITY (25-02 + 41.4 Energy Contrast System + 41.6 Transitions)
  // ==========================================================================

  // Phase 41.6: Use effectiveEnergy for smooth transition-aware emissive
  float emissiveIntensity = calculateEmissiveIntensity(effectiveEnergy, 1.0);

  // Fresnel-enhanced emissive (rim glows more)
  // Phase 41.4: Apply rim intensity multiplier for dramatic contrast
  // Dormant: nearly invisible rim | Active: bright energetic glow
  vec3 rimEmissive = baseColor * fresnel * emissiveIntensity * rimIntensityMultiplier;

  // Phase 41.6: Add afterglow contribution during power-down
  if (afterglow > 0.0) {
    rimEmissive += uColorActive * fresnel * afterglow * 0.5;
  }

  // ==========================================================================
  // SUBSURFACE SCATTERING (25-03)
  // ==========================================================================

  float sss = calculateSSS(normal, viewDir, lightDir, uInnerGlow);
  vec3 sssColor = uColorActive * sss * 0.8; // Use active color for inner glow

  // ==========================================================================
  // INTERNAL PLASMA CORE (41.2 + 41.6 Transitions + 41.8 Reference Parity)
  // ==========================================================================

  // Animated position: UV + slow time offset based on energy
  // Slow churning (dormant) -> rapid movement (max energy)
  // Phase 41.6: Use effectiveEnergy for smooth transition-aware flow
  // Phase 41.8: Enhanced flow for more visible plasma swirls
  float flowSpeed = mix(0.015, 0.15, effectiveEnergy);
  vec3 plasmaPos = vec3(
    vUv.x * 3.5,                              // Slightly larger scale for visible swirls
    vUv.y * 3.5,
    uTime * flowSpeed                          // Animate through Z
  );

  // Add circular flow for torus-appropriate swirl
  // Phase 41.8: Enhanced swirl motion matching reference
  float angle = uTime * flowSpeed * 0.6;
  plasmaPos.xy += vec2(sin(angle), cos(angle)) * 0.25;

  // Calculate plasma intensity - use effectiveEnergy for transition awareness
  float plasmaValue = plasma(plasmaPos, effectiveEnergy);

  // Get energy-appropriate plasma color - use effectiveEnergy
  vec3 plasmaColor = getPlasmaColor(effectiveEnergy);

  // Fresnel-based depth illusion: plasma visible when looking at surface,
  // fades at edges where glass rim lighting dominates
  // This creates the "inside the glass" effect
  float plasmaDepth = 1.0 - fresnel;

  // Energy-driven plasma intensity
  // Phase 41.8: Dormant plasma nearly invisible (0%Opta.png is very dark)
  // Active plasma much more visible (50%Opta.png shows bright swirls)
  float plasmaIntensity = mix(0.03, 0.95, effectiveEnergy);
  plasmaIntensity += afterglow * 0.25; // Afterglow warms the plasma during power-down

  // Phase 41.8: Enhanced plasma contrast - quadratic curve for more punch
  plasmaIntensity *= plasmaIntensity * 0.5 + plasmaIntensity * 0.5;

  // Final plasma contribution
  vec3 plasmaContribution = plasmaColor * plasmaValue * plasmaDepth * plasmaIntensity;

  // ==========================================================================
  // OBSIDIAN MIRROR EFFECT (41.3)
  // ==========================================================================

  // Calculate environment reflections
  vec3 obsidianReflection = calculateObsidianReflection(
    normal,
    viewDir,
    uMirrorReflectivity,
    uEnvReflectionIntensity,
    uTime
  );

  // Calculate sharp mirror specular from multiple light sources
  float mirrorSpec1 = calculateMirrorSpecular(normal, viewDir, lightDir, uSpecularSharpness);

  // Secondary light for rim highlights (coming from behind/side)
  vec3 rimLightDir = normalize(vec3(-0.3, 0.2, 0.8));
  float mirrorSpec2 = calculateMirrorSpecular(normal, viewDir, rimLightDir, uSpecularSharpness * 0.8);

  // Tertiary light for bottom rim accent
  vec3 bottomLightDir = normalize(vec3(0.0, -0.6, 0.4));
  float mirrorSpec3 = calculateMirrorSpecular(normal, viewDir, bottomLightDir, uSpecularSharpness * 0.6);

  // Combined mirror specular with purple tint
  vec3 mirrorSpecColor = vec3(0.9, 0.85, 1.0); // Slight purple-white tint
  vec3 mirrorSpecContribution = mirrorSpecColor * (
    mirrorSpec1 * 1.0 +
    mirrorSpec2 * 0.4 +
    mirrorSpec3 * 0.2
  );

  // ==========================================================================
  // SURFACE SHADING
  // ==========================================================================

  // Base diffuse (lambert)
  float diffuse = max(0.0, dot(normal, lightDir));
  diffuse = diffuse * 0.5 + 0.5; // Half-lambert wrap for softer falloff

  // Standard specular (kept for compatibility, reduced weight)
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(0.0, dot(normal, halfDir)), 32.0);

  // Ambient occlusion simulation (darker in concave areas)
  float ao = 1.0 - fresnel * 0.3;

  // ==========================================================================
  // COMBINE ALL EFFECTS (41.6 + 41.8: reference parity tuning)
  // ==========================================================================

  // Surface contribution - Phase 41.8: darker base for true obsidian look
  // 0%Opta.png shows near-black surface with subtle shading
  float dormantDarkening = mix(0.35, 0.75, effectiveEnergy);
  vec3 surfaceColor = baseColor * diffuse * ao * dormantDarkening;

  // Add obsidian mirror reflection (41.3)
  // Reflection is more visible when energy is low (dormant obsidian look)
  // Phase 41.8: Enhanced reflection contrast
  float reflectionWeight = mix(1.2, 0.5, effectiveEnergy);
  surfaceColor += obsidianReflection * reflectionWeight;

  // Add mirror specular highlights (41.3)
  // Sharp specular creates polished glass appearance
  // Phase 41.8: More pronounced specular for polished obsidian
  float specWeight = mix(0.9, 1.4, effectiveEnergy); // Brighter when active
  surfaceColor += mirrorSpecContribution * specWeight * uMirrorReflectivity;

  // Add standard specular (reduced, mirror specular dominates)
  // Phase 41.8: Slightly reduced to keep dormant darker
  surfaceColor += vec3(1.0) * specular * 0.15 * (0.8 + effectiveEnergy);

  // Add rim emissive (fresnel glow)
  surfaceColor += rimEmissive;

  // Add subsurface scattering - Phase 41.8: reduced for darker dormant
  surfaceColor += sssColor * mix(0.4, 1.0, effectiveEnergy);

  // Add internal plasma core (41.2)
  // Plasma blends underneath the glass surface for depth
  // Phase 41.8: Plasma contribution enhanced for 50%Opta.png vibrancy
  surfaceColor += plasmaContribution * (1.0 + effectiveEnergy * 0.3);

  // Explosion boost: additional additive glow
  if (uExploding > 0.0) {
    float explosionGlow = fresnel * uExploding;
    surfaceColor += uColorActive * explosionGlow * 2.0;
    // Plasma intensifies during explosion
    surfaceColor += plasmaColor * plasmaValue * uExploding * 0.5;
    // Mirror specular intensifies during explosion
    surfaceColor += mirrorSpecContribution * uExploding * 0.5;
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
 * Phase 41.8: Values tuned for reference image parity
 */
const defaultRingConfig: Required<RingShaderConfig> = {
  energyLevel: 0,
  innerGlow: 0.25,             // Slightly reduced for darker dormant
  fresnelPower: 3.0,
  state: 'dormant',
  // Phase 41.3: Obsidian Mirror defaults - Phase 41.8: enhanced for darker dormant
  mirrorReflectivity: 0.75,    // High reflectivity for obsidian glass
  envReflectionIntensity: 0.4, // Subtle environment reflections (reduced for darker dormant)
  specularSharpness: 160.0,    // Sharper for more polished obsidian look
  // Phase 41.4: Energy Contrast System - Phase 41.8: tuned for reference parity
  dormantFresnelPower: 10.0,   // Higher = tighter rim for near-invisible dormant (was 8.0)
  activeFresnelPower: 1.3,     // Lower = wider dramatic rim when active (was 1.5)
  dormantRimIntensity: 0.08,   // Even lower = darker dormant matching 0%Opta.png (was 0.15)
  activeRimIntensity: 3.0,     // Higher = brighter glow matching 50%Opta.png (was 2.5)
  // Phase 41.6: Suspenseful Transitions defaults
  anticipationIntensity: 0.6,  // Moderate anticipation pulse during power-up
  // Phase 41.7: Color Temperature Mastery defaults
  colorSaturation: 1.0,        // Full saturation at max energy
  colorWarmth: 1.0,            // Full warmth at max energy
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
    // Phase 41.3: Obsidian Mirror uniforms
    uMirrorReflectivity: { value: mergedConfig.mirrorReflectivity },
    uEnvReflectionIntensity: { value: mergedConfig.envReflectionIntensity },
    uSpecularSharpness: { value: mergedConfig.specularSharpness },
    // Phase 41.4: Energy Contrast System uniforms
    uDormantFresnelPower: { value: mergedConfig.dormantFresnelPower },
    uActiveFresnelPower: { value: mergedConfig.activeFresnelPower },
    uDormantRimIntensity: { value: mergedConfig.dormantRimIntensity },
    uActiveRimIntensity: { value: mergedConfig.activeRimIntensity },
    // Phase 41.6: Suspenseful Transitions uniforms
    uTransitionProgress: { value: 0 },              // No active transition
    uTransitionType: { value: 0 },                  // 0=none, 1=power-up, 2=power-down
    uPreviousEnergy: { value: mergedConfig.energyLevel }, // Previous = current at init
    uAnticipationIntensity: { value: mergedConfig.anticipationIntensity },
    // Phase 41.7: Color Temperature Mastery uniforms
    uColorSaturation: { value: mergedConfig.colorSaturation },
    uColorWarmth: { value: mergedConfig.colorWarmth },
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
 * Set obsidian mirror reflectivity (41.3)
 *
 * @param material - The ring shader material
 * @param reflectivity - Mirror reflectivity 0-1
 */
export function setRingMirrorReflectivity(
  material: ShaderMaterial,
  reflectivity: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uMirrorReflectivity.value = Math.max(0, Math.min(1, reflectivity));
}

/**
 * Set environment reflection intensity (41.3)
 *
 * @param material - The ring shader material
 * @param intensity - Environment reflection intensity 0-1
 */
export function setRingEnvReflection(
  material: ShaderMaterial,
  intensity: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uEnvReflectionIntensity.value = Math.max(0, Math.min(1, intensity));
}

/**
 * Set specular sharpness for mirror highlights (41.3)
 *
 * @param material - The ring shader material
 * @param sharpness - Specular exponent (higher = sharper, recommended 64-256)
 */
export function setRingSpecularSharpness(
  material: ShaderMaterial,
  sharpness: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uSpecularSharpness.value = Math.max(1, sharpness);
}

/**
 * Configure all obsidian mirror parameters at once (41.3)
 *
 * @param material - The ring shader material
 * @param config - Obsidian mirror configuration
 */
export function setRingObsidianMirror(
  material: ShaderMaterial,
  config: {
    reflectivity?: number;
    envReflection?: number;
    specularSharpness?: number;
  }
): void {
  if (config.reflectivity !== undefined) {
    setRingMirrorReflectivity(material, config.reflectivity);
  }
  if (config.envReflection !== undefined) {
    setRingEnvReflection(material, config.envReflection);
  }
  if (config.specularSharpness !== undefined) {
    setRingSpecularSharpness(material, config.specularSharpness);
  }
}

/**
 * Set dormant fresnel power (41.4)
 * Higher values = tighter, more subtle rim lighting when dormant
 *
 * @param material - The ring shader material
 * @param power - Fresnel power for dormant state (recommended 6-12)
 */
export function setRingDormantFresnelPower(
  material: ShaderMaterial,
  power: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uDormantFresnelPower.value = Math.max(1, power);
}

/**
 * Set active fresnel power (41.4)
 * Lower values = wider, more dramatic rim lighting when active
 *
 * @param material - The ring shader material
 * @param power - Fresnel power for active state (recommended 1-3)
 */
export function setRingActiveFresnelPower(
  material: ShaderMaterial,
  power: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uActiveFresnelPower.value = Math.max(0.5, power);
}

/**
 * Set dormant rim intensity (41.4)
 * Lower values = nearly invisible rim when dormant
 *
 * @param material - The ring shader material
 * @param intensity - Rim intensity multiplier (recommended 0.1-0.3)
 */
export function setRingDormantRimIntensity(
  material: ShaderMaterial,
  intensity: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uDormantRimIntensity.value = Math.max(0, intensity);
}

/**
 * Set active rim intensity (41.4)
 * Higher values = bright, energetic glow when active
 *
 * @param material - The ring shader material
 * @param intensity - Rim intensity multiplier (recommended 1.5-3.5)
 */
export function setRingActiveRimIntensity(
  material: ShaderMaterial,
  intensity: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uActiveRimIntensity.value = Math.max(0, intensity);
}

/**
 * Configure all energy contrast parameters at once (41.4)
 *
 * @param material - The ring shader material
 * @param config - Energy contrast configuration
 */
export function setRingEnergyContrast(
  material: ShaderMaterial,
  config: {
    dormantFresnelPower?: number;
    activeFresnelPower?: number;
    dormantRimIntensity?: number;
    activeRimIntensity?: number;
  }
): void {
  if (config.dormantFresnelPower !== undefined) {
    setRingDormantFresnelPower(material, config.dormantFresnelPower);
  }
  if (config.activeFresnelPower !== undefined) {
    setRingActiveFresnelPower(material, config.activeFresnelPower);
  }
  if (config.dormantRimIntensity !== undefined) {
    setRingDormantRimIntensity(material, config.dormantRimIntensity);
  }
  if (config.activeRimIntensity !== undefined) {
    setRingActiveRimIntensity(material, config.activeRimIntensity);
  }
}

// =============================================================================
// SUSPENSEFUL TRANSITIONS (41.6)
// =============================================================================

/**
 * Transition type constants for clarity
 */
export const TRANSITION_TYPE = {
  NONE: 0,
  POWER_UP: 1,
  POWER_DOWN: 2,
} as const;

export type TransitionType = typeof TRANSITION_TYPE[keyof typeof TRANSITION_TYPE];

/**
 * Start a power-up transition with suspenseful anticipation
 * Captures previous energy and begins dramatic ramp-up
 *
 * @param material - The ring shader material
 * @param targetEnergy - Target energy level (0-1)
 */
export function startPowerUpTransition(
  material: ShaderMaterial,
  targetEnergy: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;

  // Capture current energy as previous for transition interpolation
  uniforms.uPreviousEnergy.value = uniforms.uEnergyLevel.value;

  // Set target energy
  uniforms.uEnergyLevel.value = Math.max(0, Math.min(1, targetEnergy));

  // Initialize transition
  uniforms.uTransitionProgress.value = 0;
  uniforms.uTransitionType.value = TRANSITION_TYPE.POWER_UP;
}

/**
 * Start a power-down transition with graceful afterglow
 * Captures previous energy for lingering warmth effect
 *
 * @param material - The ring shader material
 * @param targetEnergy - Target energy level (0-1)
 */
export function startPowerDownTransition(
  material: ShaderMaterial,
  targetEnergy: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;

  // Capture current energy for afterglow calculation
  uniforms.uPreviousEnergy.value = uniforms.uEnergyLevel.value;

  // Set target energy
  uniforms.uEnergyLevel.value = Math.max(0, Math.min(1, targetEnergy));

  // Initialize transition
  uniforms.uTransitionProgress.value = 0;
  uniforms.uTransitionType.value = TRANSITION_TYPE.POWER_DOWN;
}

/**
 * Update transition progress - call each frame during active transitions
 * Progress should go from 0 to 1 over the desired transition duration
 *
 * @param material - The ring shader material
 * @param progress - Transition progress 0-1
 */
export function setTransitionProgress(
  material: ShaderMaterial,
  progress: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uTransitionProgress.value = Math.max(0, Math.min(1, progress));

  // Auto-clear transition when complete
  if (progress >= 1) {
    uniforms.uTransitionType.value = TRANSITION_TYPE.NONE;
    uniforms.uPreviousEnergy.value = uniforms.uEnergyLevel.value;
  }
}

/**
 * Clear any active transition immediately
 * Useful for interrupting transitions with new state changes
 *
 * @param material - The ring shader material
 */
export function clearTransition(material: ShaderMaterial): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uTransitionType.value = TRANSITION_TYPE.NONE;
  uniforms.uTransitionProgress.value = 0;
  uniforms.uPreviousEnergy.value = uniforms.uEnergyLevel.value;
}

/**
 * Set anticipation pulse intensity for power-up transitions
 *
 * @param material - The ring shader material
 * @param intensity - Anticipation intensity 0-1 (0.5-0.8 recommended)
 */
export function setAnticipationIntensity(
  material: ShaderMaterial,
  intensity: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uAnticipationIntensity.value = Math.max(0, Math.min(1, intensity));
}

/**
 * Check if a transition is currently active
 *
 * @param material - The ring shader material
 * @returns true if a transition is in progress
 */
export function isTransitionActive(material: ShaderMaterial): boolean {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  return uniforms.uTransitionType.value !== TRANSITION_TYPE.NONE &&
         uniforms.uTransitionProgress.value < 1;
}

/**
 * Get current transition type
 *
 * @param material - The ring shader material
 * @returns Current transition type (0=none, 1=power-up, 2=power-down)
 */
export function getTransitionType(material: ShaderMaterial): TransitionType {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  return uniforms.uTransitionType.value as TransitionType;
}

/**
 * Convenience function to start appropriate transition based on energy delta
 * Automatically chooses power-up or power-down based on target vs current
 *
 * @param material - The ring shader material
 * @param targetEnergy - Target energy level (0-1)
 */
export function startEnergyTransition(
  material: ShaderMaterial,
  targetEnergy: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  const currentEnergy = uniforms.uEnergyLevel.value;

  if (targetEnergy > currentEnergy) {
    startPowerUpTransition(material, targetEnergy);
  } else if (targetEnergy < currentEnergy) {
    startPowerDownTransition(material, targetEnergy);
  }
  // If equal, no transition needed
}

/**
 * Dispose ring shader material and free GPU resources
 */
export function disposeRingShader(material: ShaderMaterial): void {
  material.dispose();
}

// =============================================================================
// COLOR TEMPERATURE MASTERY (41.7)
// =============================================================================

/**
 * Set color saturation level (41.7)
 * Controls how vibrant colors appear at full energy
 *
 * @param material - The ring shader material
 * @param saturation - Saturation level 0-1 (0=grayscale, 1=full color)
 */
export function setRingColorSaturation(
  material: ShaderMaterial,
  saturation: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uColorSaturation.value = Math.max(0, Math.min(1, saturation));
}

/**
 * Set color warmth/temperature level (41.7)
 * Controls how warm/vibrant colors appear at full energy
 *
 * @param material - The ring shader material
 * @param warmth - Warmth level 0-1 (0=cold/neutral, 1=warm/vibrant)
 */
export function setRingColorWarmth(
  material: ShaderMaterial,
  warmth: number
): void {
  const uniforms = material.uniforms as unknown as RingShaderUniforms;
  uniforms.uColorWarmth.value = Math.max(0, Math.min(1, warmth));
}

/**
 * Configure all color temperature parameters at once (41.7)
 *
 * @param material - The ring shader material
 * @param config - Color temperature configuration
 */
export function setRingColorTemperature(
  material: ShaderMaterial,
  config: {
    saturation?: number;
    warmth?: number;
  }
): void {
  if (config.saturation !== undefined) {
    setRingColorSaturation(material, config.saturation);
  }
  if (config.warmth !== undefined) {
    setRingColorWarmth(material, config.warmth);
  }
}

// =============================================================================
// PRESETS
// =============================================================================

/**
 * Shader presets for common ring states
 * Phase 41.8: Tuned for reference image parity (0%Opta.png, 50%Opta.png)
 * Updated with Phase 41.3 obsidian mirror settings
 * Updated with Phase 41.4 energy contrast system settings
 * Updated with Phase 41.6 suspenseful transition settings
 * Updated with Phase 41.7 color temperature mastery settings
 */
export const ringShaderPresets = {
  /**
   * Dormant state - Phase 41.8: Tuned to match 0%Opta.png
   * Near-black obsidian with faint purple rim, highly reflective surface
   */
  dormant: {
    energyLevel: 0,
    innerGlow: 0.15,              // Very low - obsidian is near-black inside
    fresnelPower: 4.0,
    state: 'dormant' as const,
    mirrorReflectivity: 0.85,     // Very high reflectivity - polished obsidian
    envReflectionIntensity: 0.35, // Subtle reflections visible in reference
    specularSharpness: 180.0,     // Very sharp for polished glass look
    // Phase 41.4 + 41.8: Near-invisible rim for dark obsidian
    dormantFresnelPower: 12.0,    // Very tight rim (matching dark reference)
    activeFresnelPower: 1.3,      // (not used at 0 energy)
    dormantRimIntensity: 0.05,    // Extremely faint (0%Opta.png is very dark)
    activeRimIntensity: 3.0,      // (not used at 0 energy)
    // Phase 41.6: Subtle anticipation when waking from dormant
    anticipationIntensity: 0.5,
    // Phase 41.7: Fully desaturated cold obsidian
    colorSaturation: 1.0,         // Base saturation (energy-driven desaturation)
    colorWarmth: 1.0,             // Base warmth (energy-driven temperature)
  },
  /**
   * Active state - Phase 41.8: Tuned to match 50%Opta.png
   * Vibrant magenta-purple plasma with bright rim glow
   */
  active: {
    energyLevel: 0.55,            // Match ~50% energy in reference
    innerGlow: 0.6,               // More visible plasma interior
    fresnelPower: 2.0,
    state: 'active' as const,
    mirrorReflectivity: 0.55,     // Reduced - plasma dominates
    envReflectionIntensity: 0.3,  // Subtler reflections
    specularSharpness: 100.0,     // Slightly softer
    // Phase 41.4 + 41.8: Bright energetic glow matching reference
    dormantFresnelPower: 12.0,
    activeFresnelPower: 1.2,      // Wide dramatic rim
    dormantRimIntensity: 0.05,
    activeRimIntensity: 3.2,      // Bright glow matching 50%Opta.png
    // Phase 41.6: Strong anticipation for dramatic activation
    anticipationIntensity: 0.7,
    // Phase 41.7: Vibrant warm purple
    colorSaturation: 1.0,         // Full saturation at active energy
    colorWarmth: 1.0,             // Full warmth for vibrant purple
  },
  /** Processing state - pulsing between cold and warm */
  processing: {
    energyLevel: 0.4,
    innerGlow: 0.45,
    fresnelPower: 2.5,
    state: 'processing' as const,
    mirrorReflectivity: 0.65,
    envReflectionIntensity: 0.35,
    specularSharpness: 130.0,
    // Phase 41.4 + 41.8: Mid-range contrast during pulse
    dormantFresnelPower: 12.0,
    activeFresnelPower: 1.3,
    dormantRimIntensity: 0.05,
    activeRimIntensity: 3.0,
    // Phase 41.6: Moderate anticipation
    anticipationIntensity: 0.6,
    // Phase 41.7: Mid-range color temperature
    colorSaturation: 1.0,
    colorWarmth: 1.0,
  },
  /** Exploding state - maximum warmth, bright violet glow */
  exploding: {
    energyLevel: 1.0,
    innerGlow: 1.0,
    fresnelPower: 1.5,
    state: 'exploding' as const,
    mirrorReflectivity: 0.4,      // Minimal - energy overwhelms
    envReflectionIntensity: 0.2,  // Almost hidden by glow
    specularSharpness: 60.0,      // Broader hot glow
    // Phase 41.4 + 41.8: Maximum intensity - full energy
    dormantFresnelPower: 12.0,
    activeFresnelPower: 1.0,      // Extra wide for explosion
    dormantRimIntensity: 0.05,
    activeRimIntensity: 4.0,      // Extra bright for explosion
    // Phase 41.6: Maximum anticipation for explosion buildup
    anticipationIntensity: 0.9,
    // Phase 41.7: Maximum saturation and warmth for bright violet
    colorSaturation: 1.0,         // Full vibrant color
    colorWarmth: 1.0,             // Maximum warmth
  },
} as const;

export type RingShaderPreset = keyof typeof ringShaderPresets;

/**
 * Create ring shader from preset
 */
export function createRingShaderFromPreset(preset: RingShaderPreset): ShaderMaterial {
  return createRingShader(ringShaderPresets[preset]);
}
