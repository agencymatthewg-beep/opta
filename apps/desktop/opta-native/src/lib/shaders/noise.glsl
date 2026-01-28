/**
 * Noise Generation Shader Utilities
 *
 * Simplex 2D noise for grain texture and procedural effects.
 * Used in glass shader for noise overlay layer.
 *
 * @see DESIGN_SYSTEM.md - Obsidian Glass Material System
 */

// =============================================================================
// PERMUTATION FUNCTION
// =============================================================================

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

// =============================================================================
// SIMPLEX 2D NOISE
// =============================================================================

/**
 * Simplex 2D noise function
 * Returns value in range [-1, 1]
 * @param v - 2D coordinate
 */
float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  // First corner
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  // Other corners
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  // Gradients
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  // Normalize gradients
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  // Compute final noise value
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

// =============================================================================
// FRACTAL BROWNIAN MOTION (FBM)
// =============================================================================

/**
 * Fractal Brownian Motion noise
 * Combines multiple octaves of simplex noise
 * @param st - 2D coordinate
 * @param octaves - Number of noise layers (1-8)
 */
float fbm(vec2 st, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(st * frequency);
    st *= 2.0;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

// =============================================================================
// GRAIN NOISE
// =============================================================================

/**
 * Film grain noise for glass overlay
 * @param uv - UV coordinates
 * @param time - Animation time for temporal variation
 * @param intensity - Grain strength (0-1)
 */
float grain(vec2 uv, float time, float intensity) {
  float noise = snoise(uv * 500.0 + time * 0.5);
  return noise * intensity;
}

/**
 * Soft grain with smooth falloff
 * @param uv - UV coordinates
 * @param time - Animation time
 * @param intensity - Grain strength (0-1)
 */
float softGrain(vec2 uv, float time, float intensity) {
  float n1 = snoise(uv * 300.0 + time * 0.3);
  float n2 = snoise(uv * 600.0 - time * 0.2);
  float combined = (n1 + n2 * 0.5) / 1.5;
  return combined * intensity;
}
