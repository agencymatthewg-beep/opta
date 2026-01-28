/**
 * OLED Dithering Fragment Shader
 *
 * Implements blue noise dithering to prevent banding on OLED displays.
 * Essential for smooth gradients in the obsidian glass aesthetic.
 *
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 */

precision highp float;

// =============================================================================
// UNIFORMS
// =============================================================================

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;
uniform float uDitherStrength;   // Dithering intensity (0-1)
uniform bool uAnimated;           // Use temporal dithering

varying vec2 vUv;

// =============================================================================
// BLUE NOISE GENERATION
// =============================================================================

/**
 * Hash function for pseudo-random number generation
 * Based on spatial coordinates for consistent pattern
 */
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/**
 * Interleaved gradient noise
 * Better visual quality than pure random for dithering
 */
float interleavedGradientNoise(vec2 p) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(p, magic.xy)));
}

/**
 * Blue noise approximation using interleaved gradient
 * Provides optimal dithering pattern for human perception
 */
float blueNoise(vec2 coord, float time) {
  float noise = interleavedGradientNoise(coord);

  // Add temporal variation for animated dithering
  // This helps prevent static pattern visibility on still frames
  float temporal = fract(time * 0.5);
  noise = fract(noise + temporal * 0.618033988749895); // Golden ratio

  return noise;
}

// =============================================================================
// DITHERING FUNCTIONS
// =============================================================================

/**
 * Apply dithering to a single color channel
 * Uses ordered dithering pattern for smooth results
 */
float ditherChannel(float color, float noise, float strength) {
  // Scale noise to dithering range
  float dither = (noise - 0.5) * strength;

  // Add dither and quantize to prevent banding
  return color + dither / 255.0;
}

/**
 * Apply dithering to RGB color
 * Each channel gets slightly different noise for natural look
 */
vec3 ditherColor(vec3 color, vec2 coord, float time, float strength) {
  // Generate noise for each channel with slight offset
  float noiseR = blueNoise(coord, time);
  float noiseG = blueNoise(coord + vec2(17.0, 31.0), time);
  float noiseB = blueNoise(coord + vec2(59.0, 83.0), time);

  return vec3(
    ditherChannel(color.r, noiseR, strength),
    ditherChannel(color.g, noiseG, strength),
    ditherChannel(color.b, noiseB, strength)
  );
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  vec2 uv = vUv;

  // Sample source texture
  vec4 color = texture2D(uTexture, uv);

  // Skip dithering if strength is zero
  if (uDitherStrength < 0.001) {
    gl_FragColor = color;
    return;
  }

  // Get screen-space coordinates for consistent pattern
  vec2 screenCoord = gl_FragCoord.xy;

  // Calculate dithering time (static or animated)
  float ditherTime = uAnimated ? uTime : 0.0;

  // Apply dithering
  vec3 ditheredColor = ditherColor(color.rgb, screenCoord, ditherTime, uDitherStrength);

  // Clamp to valid range
  ditheredColor = clamp(ditheredColor, 0.0, 1.0);

  gl_FragColor = vec4(ditheredColor, color.a);
}
