/**
 * Deep Glow Fragment Shader
 *
 * Multi-layer glow effect that responds to system metrics.
 * Implements 2025 design trend differentiation with reactive ambient animations.
 *
 * Layers:
 * - Layer 1: Soft outer corona (exponential falloff)
 * - Layer 2: Brighter inner core
 * - Layer 3: Subtle animated shimmer
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity;    // 0.0 - 1.0 based on CPU/memory load
uniform vec3 uColor;         // Semantic color from design system
uniform float uPulseSpeed;   // Animation speed multiplier
uniform float uActive;       // Active state (0 = off, 1 = full)

varying vec2 vUv;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

// Pseudo-random noise function
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise for shimmer
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Soft distance field for rounded rectangle glow
float sdRoundedRectGlow(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

// Multi-layer corona effect
vec4 deepGlowCorona(float dist, vec3 color, float intensity, float time) {
  // Layer 1: Soft outer corona (exponential falloff)
  float outerCorona = exp(-abs(dist) * 2.0) * intensity * 0.4;

  // Layer 2: Brighter inner core
  float innerCore = exp(-abs(dist) * 8.0) * intensity * 0.8;
  float innerBright = exp(-abs(dist) * 20.0) * intensity;

  // Layer 3: Shimmer animation
  float shimmerNoise = noise(vUv * 10.0 + time * 0.5);
  float shimmer = shimmerNoise * 0.15 * intensity;

  // Pulsing effect based on intensity
  float pulse = sin(time * 2.0) * 0.1 + 1.0;
  float breathe = mix(1.0, pulse, intensity);

  // Color grading by layer
  vec3 coreColor = mix(color, vec3(1.0), 0.5); // Brighter at core
  vec3 midColor = color * 1.2;
  vec3 outerColor = color * 0.6;

  // Combine layers
  vec3 finalColor = coreColor * innerBright * breathe
                  + midColor * innerCore
                  + outerColor * outerCorona
                  + color * shimmer;

  // Alpha compositing
  float finalAlpha = innerBright + innerCore * 0.7 + outerCorona * 0.4 + shimmer * 0.3;
  finalAlpha = clamp(finalAlpha, 0.0, 1.0);

  return vec4(finalColor, finalAlpha);
}

void main() {
  // Normalized coordinates centered at origin
  vec2 uv = vUv * 2.0 - 1.0;

  // Maintain aspect ratio
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  // Rectangle parameters (fill most of the canvas)
  vec2 rectSize = vec2(0.9 * aspect, 0.9);
  float cornerRadius = 0.12; // Matches glass panel radius

  // Calculate signed distance to rounded rect edge
  float dist = sdRoundedRectGlow(uv, rectSize, cornerRadius);

  // Only render glow outside the rectangle (dist > 0)
  // with falloff starting at the edge
  float edgeDist = max(dist, 0.0);

  // Get glow effect
  vec4 glow = deepGlowCorona(edgeDist, uColor, uIntensity, uTime * uPulseSpeed);

  // Apply active state
  glow *= uActive;

  // Critical/pulsing red effect for high intensity
  if (uIntensity > 0.85) {
    float criticalPulse = sin(uTime * 4.0) * 0.3 + 0.7;
    glow.rgb *= criticalPulse;
  }

  gl_FragColor = glow;
}
