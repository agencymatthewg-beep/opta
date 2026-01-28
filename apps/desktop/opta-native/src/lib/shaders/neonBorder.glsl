/**
 * Neon Border Fragment Shader
 *
 * Implements SweepGradient (conic gradient) with "traveling light" effect.
 * Creates premium neon halation: core color (bright white/purple) +
 * corona (saturated hue, exponential fade).
 *
 * Based on Gemini research: "SweepGradient on RoundedRect stroke"
 * @see DESIGN_SYSTEM.md - The Opta Ring / Neon Effects
 */

precision highp float;

// =============================================================================
// UNIFORMS
// =============================================================================

uniform float uTime;
uniform vec2 uResolution;
uniform float uBorderRadius;      // Corner radius (0-1 normalized)
uniform float uBorderWidth;       // Border thickness (0-0.1)
uniform vec3 uNeonColor;          // Primary neon color RGB
uniform float uGlowIntensity;     // Glow multiplier (0-2)
uniform float uAnimationSpeed;    // Rotation speed multiplier
uniform float uActive;            // Active state (0-1)

varying vec2 vUv;

// =============================================================================
// CONSTANTS
// =============================================================================

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

// =============================================================================
// SIGNED DISTANCE FUNCTIONS
// =============================================================================

/**
 * Signed distance function for rounded rectangle
 * Returns positive values outside, negative inside
 *
 * @param p - Point position
 * @param size - Half-size of rectangle
 * @param radius - Corner radius
 */
float sdRoundedRect(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

/**
 * SDF for a ring (hollow circle)
 */
float sdRing(vec2 p, float innerRadius, float outerRadius) {
  float d = length(p);
  return max(d - outerRadius, innerRadius - d);
}

// =============================================================================
// SWEEP GRADIENT (CONIC GRADIENT)
// =============================================================================

/**
 * Creates a sweep/conic gradient based on angle from center
 * Used for the "traveling light" effect
 *
 * @param uv - UV coordinates (centered at 0)
 * @param time - Animation time
 * @param speed - Rotation speed
 */
float sweepGradient(vec2 uv, float time, float speed) {
  // Calculate angle from center
  float angle = atan(uv.y, uv.x);

  // Normalize angle to 0-1 range and animate
  float sweep = fract(angle / TWO_PI + time * speed);

  // Create smooth falloff for the "traveling light" look
  // Sharp leading edge, soft trailing edge
  float light = smoothstep(0.0, 0.3, sweep) * (1.0 - smoothstep(0.3, 0.7, sweep));

  // Add secondary smaller highlight for depth
  float secondary = smoothstep(0.6, 0.7, sweep) * (1.0 - smoothstep(0.7, 0.9, sweep)) * 0.3;

  return light + secondary;
}

// =============================================================================
// NEON HALATION EFFECT
// =============================================================================

/**
 * Creates the halation glow effect:
 * - Core: Bright white/purple center
 * - Corona: Saturated color with exponential fade
 *
 * @param dist - Distance from border edge
 * @param color - Base neon color
 * @param intensity - Glow intensity multiplier
 */
vec4 neonHalation(float dist, vec3 color, float intensity) {
  // Core glow (bright, concentrated)
  float core = exp(-abs(dist) * 30.0) * intensity;

  // Corona glow (wider, softer)
  float corona = exp(-abs(dist) * 8.0) * intensity * 0.6;

  // Outer haze (very wide, subtle)
  float haze = exp(-abs(dist) * 3.0) * intensity * 0.15;

  // Core is bright white, corona is colored
  vec3 coreColor = mix(color, vec3(1.0), 0.7);
  vec3 coronaColor = color * 1.2; // Slightly oversaturated
  vec3 hazeColor = color * 0.5;

  // Combine layers
  vec3 finalColor = coreColor * core + coronaColor * corona + hazeColor * haze;
  float finalAlpha = core + corona * 0.8 + haze * 0.3;

  return vec4(finalColor, finalAlpha);
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  // Normalize UV to -1 to 1 range (centered)
  vec2 uv = vUv * 2.0 - 1.0;

  // Correct for aspect ratio
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  // Calculate distance to rounded rectangle border
  vec2 rectSize = vec2(0.85 * aspect, 0.85);
  float dist = sdRoundedRect(uv, rectSize, uBorderRadius);

  // Get sweep gradient for traveling light
  float sweep = sweepGradient(uv, uTime, uAnimationSpeed);

  // Calculate border region
  float borderOuter = smoothstep(uBorderWidth, 0.0, dist);
  float borderInner = smoothstep(-uBorderWidth, 0.0, dist);
  float border = borderOuter * borderInner;

  // Apply sweep to border (traveling light effect)
  float travelingLight = border * (0.3 + sweep * 0.7);

  // Create halation glow
  vec4 glow = neonHalation(dist, uNeonColor, uGlowIntensity * uActive);

  // Add traveling light to glow
  glow.rgb += uNeonColor * travelingLight * uActive;
  glow.a = max(glow.a, travelingLight * uActive);

  // Apply active state fade
  glow *= uActive;

  // Output final color
  gl_FragColor = glow;
}
