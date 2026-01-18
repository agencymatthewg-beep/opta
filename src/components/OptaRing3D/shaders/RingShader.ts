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
 * Calculate plasma color based on energy level
 * Dark purple (dormant) -> vibrant purple (active) -> bright violet/white (max)
 */
vec3 getPlasmaColor(float energy) {
  vec3 dormantColor = vec3(0.08, 0.0, 0.12);   // Near-black purple
  vec3 activeColor = vec3(0.45, 0.0, 0.65);    // Vibrant purple
  vec3 maxColor = vec3(0.75, 0.55, 0.95);      // Bright violet-white

  if (energy < 0.5) {
    return mix(dormantColor, activeColor, energy * 2.0);
  } else {
    return mix(activeColor, maxColor, (energy - 0.5) * 2.0);
  }
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
  // FRESNEL CALCULATION (25-01 + 41.4 Energy Contrast System)
  // ==========================================================================

  // Phase 41.4: Energy-driven fresnel power interpolation
  // Dormant: high power (8.0) = tight, minimal rim
  // Active: low power (1.5) = wide, dramatic rim
  float fresnelPower = calculateEnergyFresnelPower(
    uDormantFresnelPower,
    uActiveFresnelPower,
    uEnergyLevel
  );
  float fresnel = calculateFresnel(normal, viewDir, fresnelPower, uFresnelBias);

  // Phase 41.4: Energy-driven rim intensity for dramatic contrast
  // Dormant: very low intensity (0.15) = nearly invisible
  // Active: high intensity (2.5) = bright, energetic glow
  float rimIntensityMultiplier = calculateEnergyRimIntensity(
    uDormantRimIntensity,
    uActiveRimIntensity,
    uEnergyLevel
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

  // Get base color for current state
  vec3 baseColor = calculateStateColor(
    uColorDormant,
    uColorActive,
    uColorExplode,
    stateBlend,
    uExploding
  );

  // ==========================================================================
  // EMISSIVE INTENSITY (25-02 + 41.4 Energy Contrast System)
  // ==========================================================================

  float emissiveIntensity = calculateEmissiveIntensity(uEnergyLevel, 1.0);

  // Fresnel-enhanced emissive (rim glows more)
  // Phase 41.4: Apply rim intensity multiplier for dramatic contrast
  // Dormant: nearly invisible rim | Active: bright energetic glow
  vec3 rimEmissive = baseColor * fresnel * emissiveIntensity * rimIntensityMultiplier;

  // ==========================================================================
  // SUBSURFACE SCATTERING (25-03)
  // ==========================================================================

  float sss = calculateSSS(normal, viewDir, lightDir, uInnerGlow);
  vec3 sssColor = uColorActive * sss * 0.8; // Use active color for inner glow

  // ==========================================================================
  // INTERNAL PLASMA CORE (41.2)
  // ==========================================================================

  // Animated position: UV + slow time offset based on energy
  // Slow churning (dormant) -> rapid movement (max energy)
  float flowSpeed = mix(0.02, 0.12, uEnergyLevel);
  vec3 plasmaPos = vec3(
    vUv.x * 4.0,                              // Scale UV for detail
    vUv.y * 4.0,
    uTime * flowSpeed                          // Animate through Z
  );

  // Add circular flow for torus-appropriate swirl
  float angle = uTime * flowSpeed * 0.5;
  plasmaPos.xy += vec2(sin(angle), cos(angle)) * 0.2;

  // Calculate plasma intensity
  float plasmaValue = plasma(plasmaPos, uEnergyLevel);

  // Get energy-appropriate plasma color
  vec3 plasmaColor = getPlasmaColor(uEnergyLevel);

  // Fresnel-based depth illusion: plasma visible when looking at surface,
  // fades at edges where glass rim lighting dominates
  // This creates the "inside the glass" effect
  float plasmaDepth = 1.0 - fresnel;

  // Energy-driven plasma intensity
  // Even at 0% energy, subtle plasma is visible (sleeping, not dead)
  float plasmaIntensity = mix(0.15, 0.85, uEnergyLevel);

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
  // COMBINE ALL EFFECTS
  // ==========================================================================

  // Surface contribution - darker base for obsidian look
  vec3 surfaceColor = baseColor * diffuse * ao * 0.7;

  // Add obsidian mirror reflection (41.3)
  // Reflection is more visible when energy is low (dormant obsidian look)
  float reflectionWeight = mix(1.0, 0.6, uEnergyLevel);
  surfaceColor += obsidianReflection * reflectionWeight;

  // Add mirror specular highlights (41.3)
  // Sharp specular creates polished glass appearance
  float specWeight = mix(0.8, 1.2, uEnergyLevel); // Brighter when active
  surfaceColor += mirrorSpecContribution * specWeight * uMirrorReflectivity;

  // Add standard specular (reduced, mirror specular dominates)
  surfaceColor += vec3(1.0) * specular * 0.2 * (1.0 + uEnergyLevel);

  // Add rim emissive (fresnel glow)
  surfaceColor += rimEmissive;

  // Add subsurface scattering
  surfaceColor += sssColor;

  // Add internal plasma core (41.2)
  // Plasma blends underneath the glass surface for depth
  // Plasma shows through the obsidian glass
  surfaceColor += plasmaContribution;

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
 */
const defaultRingConfig: Required<RingShaderConfig> = {
  energyLevel: 0,
  innerGlow: 0.3,
  fresnelPower: 3.0,
  state: 'dormant',
  // Phase 41.3: Obsidian Mirror defaults
  mirrorReflectivity: 0.7,      // High reflectivity for obsidian glass
  envReflectionIntensity: 0.5, // Subtle environment reflections
  specularSharpness: 128.0,    // Sharp mirror-like specular highlights
  // Phase 41.4: Energy Contrast System defaults
  dormantFresnelPower: 8.0,    // High = tight, minimal rim when dormant
  activeFresnelPower: 1.5,     // Low = wide, dramatic rim when active
  dormantRimIntensity: 0.15,   // Very low = nearly invisible when dormant
  activeRimIntensity: 2.5,     // High = bright energetic glow when active
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
 * Updated with Phase 41.3 obsidian mirror settings
 * Updated with Phase 41.4 energy contrast system settings
 */
export const ringShaderPresets = {
  /** Default dormant state - nearly invisible rim, maximum obsidian reflection */
  dormant: {
    energyLevel: 0,
    innerGlow: 0.2,
    fresnelPower: 3.5,
    state: 'dormant' as const,
    mirrorReflectivity: 0.8,       // High reflectivity when dormant
    envReflectionIntensity: 0.6,  // Visible environment reflections
    specularSharpness: 128.0,     // Sharp polished look
    // Phase 41.4: Maximum contrast - nearly invisible
    dormantFresnelPower: 8.0,     // Tight rim
    activeFresnelPower: 1.5,      // (not used at 0 energy)
    dormantRimIntensity: 0.15,    // Nearly invisible
    activeRimIntensity: 2.5,      // (not used at 0 energy)
  },
  /** Active state - bright energetic rim glow, reduced reflection */
  active: {
    energyLevel: 0.6,
    innerGlow: 0.5,
    fresnelPower: 2.5,
    state: 'active' as const,
    mirrorReflectivity: 0.6,       // Reduced - plasma dominates
    envReflectionIntensity: 0.4,  // Subtler reflections
    specularSharpness: 96.0,      // Slightly softer
    // Phase 41.4: Energetic glow
    dormantFresnelPower: 8.0,
    activeFresnelPower: 1.5,      // Wide dramatic rim
    dormantRimIntensity: 0.15,
    activeRimIntensity: 2.5,      // Bright glow
  },
  /** Processing state - pulsing between states */
  processing: {
    energyLevel: 0.4,
    innerGlow: 0.4,
    fresnelPower: 3.0,
    state: 'processing' as const,
    mirrorReflectivity: 0.7,
    envReflectionIntensity: 0.5,
    specularSharpness: 112.0,
    // Phase 41.4: Mid-range contrast during pulse
    dormantFresnelPower: 8.0,
    activeFresnelPower: 1.5,
    dormantRimIntensity: 0.15,
    activeRimIntensity: 2.5,
  },
  /** Exploding state - maximum energy, intense rim, plasma-dominated */
  exploding: {
    energyLevel: 1.0,
    innerGlow: 1.0,
    fresnelPower: 2.0,
    state: 'exploding' as const,
    mirrorReflectivity: 0.5,       // Minimal - energy overwhelms
    envReflectionIntensity: 0.3,  // Almost hidden by glow
    specularSharpness: 64.0,      // Broader hot glow
    // Phase 41.4: Maximum intensity - full energy
    dormantFresnelPower: 8.0,
    activeFresnelPower: 1.2,      // Extra wide for explosion
    dormantRimIntensity: 0.15,
    activeRimIntensity: 3.5,      // Extra bright for explosion
  },
} as const;

export type RingShaderPreset = keyof typeof ringShaderPresets;

/**
 * Create ring shader from preset
 */
export function createRingShaderFromPreset(preset: RingShaderPreset): ShaderMaterial {
  return createRingShader(ringShaderPresets[preset]);
}
