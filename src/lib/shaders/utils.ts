/**
 * Shader Utilities - Common helpers for WebGL shaders
 *
 * Provides color conversion, uniform management, and WebGL context utilities.
 * Part of the Opta Premium Visual Effects system.
 */

import { Color, Vector2 } from 'three';

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Convert CSS color string to Three.js Color
 * Supports hex, rgb, rgba, hsl, and named colors
 */
export function cssToThreeColor(cssColor: string): Color {
  const color = new Color();

  // Handle CSS custom properties
  if (cssColor.startsWith('var(')) {
    // Extract variable name and try to get computed value
    if (typeof window !== 'undefined') {
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(cssColor.slice(4, -1).trim());
      if (computed) {
        return cssToThreeColor(computed.trim());
      }
    }
    // Fallback to primary purple if variable can't be resolved
    return new Color(0x8b5cf6);
  }

  // Handle HSL format (common in Opta design system)
  if (cssColor.includes(' ') && !cssColor.includes('rgb') && !cssColor.includes('hsl')) {
    // Likely HSL values like "265 90% 65%"
    const parts = cssColor.split(/\s+/);
    if (parts.length >= 3) {
      const h = parseFloat(parts[0]) / 360;
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;
      color.setHSL(h, s, l);
      return color;
    }
  }

  // Handle standard CSS color formats
  try {
    color.set(cssColor);
  } catch {
    // Fallback to primary purple
    color.setHex(0x8b5cf6);
  }

  return color;
}

/**
 * Get Opta primary color as Three.js Color
 */
export function getOptaPrimaryColor(): Color {
  return new Color(0x8b5cf6); // Electric Violet
}

/**
 * Get Opta glow color with alpha for shader use
 */
export function getOptaGlowColorArray(): [number, number, number, number] {
  const color = getOptaPrimaryColor();
  return [color.r, color.g, color.b, 0.6];
}

// =============================================================================
// UNIFORM HELPERS
// =============================================================================

/**
 * Create a uniform object from a value
 */
export function uniform<T>(value: T): { value: T } {
  return { value };
}

/**
 * Create time uniform with initial value
 */
export function createTimeUniform(initialTime = 0): { uTime: { value: number } } {
  return { uTime: { value: initialTime } };
}

/**
 * Create resolution uniform from dimensions
 */
export function createResolutionUniform(
  width: number,
  height: number
): { uResolution: { value: Vector2 } } {
  return { uResolution: { value: new Vector2(width, height) } };
}

/**
 * Update time uniform (call in animation loop)
 */
export function updateTimeUniform(
  uniforms: { uTime: { value: number } },
  delta: number
): void {
  uniforms.uTime.value += delta;
}

// =============================================================================
// GLSL SHADER UTILITIES (Inline fragments)
// =============================================================================

/** Common vertex shader for full-screen quad effects */
export const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Pass-through vertex shader for custom fragment effects */
export const passthroughVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// =============================================================================
// WEBGL CONTEXT UTILITIES
// =============================================================================

/**
 * Check if WebGL is available
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Check if WebGL 2 is available (preferred)
 */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Get maximum texture size supported by GPU
 */
export function getMaxTextureSize(): number {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return 2048; // Safe fallback
  return gl.getParameter(gl.MAX_TEXTURE_SIZE);
}

// =============================================================================
// PERFORMANCE UTILITIES
// =============================================================================

/**
 * Create a simple FPS counter
 */
export function createFPSCounter() {
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 60;

  return {
    tick: () => {
      frameCount++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        fps = Math.round((frameCount * 1000) / delta);
        frameCount = 0;
        lastTime = currentTime;
      }

      return fps;
    },
    getFPS: () => fps,
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// =============================================================================
// MATH UTILITIES FOR SHADERS
// =============================================================================

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Smooth step interpolation
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
