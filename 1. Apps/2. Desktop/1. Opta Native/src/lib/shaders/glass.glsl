/**
 * Glass Effect Fragment Shader
 *
 * Implements 4-layer optical glass simulation:
 * Layer 1: Backdrop (sampled from texture)
 * Layer 2: Blur Pass (Gaussian approximation)
 * Layer 3: Noise Overlay (Soft Light blend)
 * Layer 4: Specular Highlight (rotating conical gradient)
 *
 * Based on Gemini "Neon Luminal Glassmorphism" research.
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 */

precision highp float;

// =============================================================================
// UNIFORMS
// =============================================================================

uniform sampler2D uBackdrop;
uniform float uBlurAmount;       // 0-20 pixels
uniform float uNoiseIntensity;   // 0-0.1
uniform vec2 uSpecularPosition;  // Normalized 0-1
uniform vec3 uSpecularColor;     // RGB
uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;

varying vec2 vUv;

// =============================================================================
// CONSTANTS
// =============================================================================

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

// =============================================================================
// NOISE FUNCTIONS (Inline for single-file shader)
// =============================================================================

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

// =============================================================================
// BLUR FUNCTIONS
// =============================================================================

/**
 * 9-tap Gaussian blur approximation
 * Provides smooth blur without expensive texture samples
 */
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

/**
 * Progressive blur that fades at edges
 * Creates depth illusion for glass panels
 */
vec4 progressiveBlur(sampler2D tex, vec2 uv, vec2 resolution, float amount) {
  // Edge falloff - blur is stronger in center
  vec2 center = vec2(0.5);
  float edgeDist = length(uv - center) * 2.0;
  float edgeFactor = 1.0 - smoothstep(0.5, 1.0, edgeDist);

  float adjustedAmount = amount * (0.5 + edgeFactor * 0.5);

  // Two-pass blur approximation
  vec4 blurH = blur9(tex, uv, resolution, vec2(adjustedAmount, 0.0));
  vec4 blurV = blur9(tex, uv, resolution, vec2(0.0, adjustedAmount));

  return (blurH + blurV) * 0.5;
}

// =============================================================================
// SPECULAR HIGHLIGHT
// =============================================================================

/**
 * Rotating specular highlight
 * Creates premium "light source" effect on glass
 */
float specularHighlight(vec2 uv, vec2 lightPos, float time) {
  // Animate light position in circular path
  float angle = time * 0.3;
  vec2 animatedPos = lightPos + vec2(cos(angle), sin(angle)) * 0.1;

  // Distance from light
  float dist = length(uv - animatedPos);

  // Conical gradient falloff
  float highlight = 1.0 - smoothstep(0.0, 0.4, dist);
  highlight = pow(highlight, 3.0); // Sharper falloff

  // Add subtle secondary highlight
  float secondary = 1.0 - smoothstep(0.0, 0.6, dist);
  secondary = pow(secondary, 2.0) * 0.3;

  return highlight + secondary;
}

// =============================================================================
// SOFT LIGHT BLEND
// =============================================================================

/**
 * Soft Light blend mode for noise overlay
 * Prevents harsh banding on gradients
 */
vec3 softLight(vec3 base, float overlay) {
  vec3 result;
  float ov = overlay * 0.5 + 0.5; // Convert from [-1,1] to [0,1]

  // Soft light formula
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
  vec2 uv = vUv;

  // Layer 1 & 2: Backdrop with progressive blur
  vec4 backdrop = progressiveBlur(uBackdrop, uv, uResolution, uBlurAmount);

  // Layer 3: Noise overlay (film grain for anti-banding)
  float noise = snoise(uv * 500.0 + uTime * 0.5) * uNoiseIntensity;
  vec3 colorWithNoise = softLight(backdrop.rgb, noise);

  // Layer 4: Specular highlight (rotating light source)
  float specular = specularHighlight(uv, uSpecularPosition, uTime);
  vec3 specularContrib = uSpecularColor * specular * 0.4;

  // Combine all layers
  vec3 finalColor = colorWithNoise + specularContrib;

  // Subtle vignette for depth
  float vignette = 1.0 - smoothstep(0.4, 0.9, length(uv - 0.5) * 1.2);
  finalColor *= 0.95 + vignette * 0.05;

  // Output with slight transparency for obsidian glass feel
  gl_FragColor = vec4(finalColor, backdrop.a * 0.9);
}
