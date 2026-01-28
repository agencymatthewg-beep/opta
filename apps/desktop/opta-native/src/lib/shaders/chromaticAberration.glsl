/**
 * Chromatic Aberration Fragment Shader
 *
 * Implements RGB channel separation for loading/transition states.
 * Features animated pulse effect for visual feedback during loading.
 *
 * Supports both radial (lens-like) and linear aberration modes.
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

precision highp float;

// =============================================================================
// UNIFORMS
// =============================================================================

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;        // Aberration strength (0-1)
uniform float uAnimationPhase;   // Animation phase (0 = off, 1 = full effect)
uniform vec2 uCenter;            // Center point for radial mode
uniform bool uRadialMode;        // Use radial (true) or linear (false) aberration

varying vec2 vUv;

// =============================================================================
// CONSTANTS
// =============================================================================

const float PI = 3.14159265359;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Smooth pulse function for loading animation
 * Creates a gentle breathing effect
 */
float pulse(float time) {
  return sin(time * 3.0) * 0.5 + 0.5;
}

/**
 * Calculate chromatic offset direction
 * Radial: offset away from center
 * Linear: offset horizontally
 */
vec2 getOffsetDirection(vec2 uv, vec2 center, bool radial) {
  if (radial) {
    return normalize(uv - center);
  }
  return vec2(1.0, 0.0);
}

// =============================================================================
// CHROMATIC ABERRATION
// =============================================================================

/**
 * Apply chromatic aberration to a texture
 * Separates RGB channels with slight offsets
 *
 * @param tex - Source texture
 * @param uv - UV coordinates
 * @param direction - Direction of aberration
 * @param intensity - Effect intensity
 */
vec4 chromaticAberration(sampler2D tex, vec2 uv, vec2 direction, float intensity) {
  // RGB channel offsets (subtle separation)
  float rOffset = intensity * 0.012;
  float gOffset = 0.0;
  float bOffset = -intensity * 0.012;

  // Calculate offset UVs for each channel
  vec2 rUv = uv + direction * rOffset;
  vec2 gUv = uv + direction * gOffset;
  vec2 bUv = uv + direction * bOffset;

  // Sample each channel separately
  float r = texture2D(tex, rUv).r;
  float g = texture2D(tex, gUv).g;
  float b = texture2D(tex, bUv).b;

  // Get alpha from original position
  float a = texture2D(tex, uv).a;

  return vec4(r, g, b, a);
}

/**
 * Distance-based aberration intensity
 * Stronger effect at edges (mimics lens distortion)
 */
float distanceIntensity(vec2 uv, vec2 center) {
  float dist = length(uv - center);
  // Quadratic falloff from center
  return dist * dist * 2.0;
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  vec2 uv = vUv;

  // Early exit if effect is disabled
  if (uAnimationPhase < 0.001) {
    gl_FragColor = texture2D(uTexture, uv);
    return;
  }

  // Calculate pulsing intensity for loading animation
  float pulseValue = pulse(uTime);
  float animatedIntensity = uIntensity * (0.5 + pulseValue * 0.5) * uAnimationPhase;

  // Get offset direction based on mode
  vec2 direction = getOffsetDirection(uv, uCenter, uRadialMode);

  // Apply distance-based intensity modulation (radial mode only)
  if (uRadialMode) {
    float distMod = distanceIntensity(uv, uCenter);
    animatedIntensity *= distMod;
  }

  // Apply chromatic aberration
  vec4 color = chromaticAberration(uTexture, uv, direction, animatedIntensity);

  // Add subtle color fringing at high intensities
  if (animatedIntensity > 0.5) {
    float fringe = smoothstep(0.5, 1.0, animatedIntensity) * 0.1;
    color.r += fringe * pulseValue;
    color.b += fringe * (1.0 - pulseValue);
  }

  gl_FragColor = color;
}
