/**
 * ChromeBorder - GPU-Rendered Neon Border Mesh
 *
 * Renders a traveling light border effect around registered chrome panels.
 * Uses the NeonBorderShader for halation glow effects.
 *
 * Features:
 * - Traveling light animation
 * - Halation glow (core + corona + haze)
 * - Energy state synchronization
 * - Corner accumulation effects
 *
 * @see NeonBorderShader.ts - The underlying shader
 * @see ChromeCanvas.tsx - Parent rendering context
 * @see DESIGN_SYSTEM.md - Neon Effects Guidelines
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChromePanelRegistration, ChromeEnergyState } from './ChromeRegistry';
import { usePerformance } from '@/contexts/PerformanceContext';

// =============================================================================
// TYPES
// =============================================================================

export interface ChromeBorderProps {
  /** Panel registration data */
  registration: ChromePanelRegistration;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Override animation speed */
  animationSpeed?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Energy state to animation speed mapping */
const ENERGY_SPEED: Record<ChromeEnergyState, number> = {
  dormant: 0.15,
  active: 0.4,
  pulse: 0.8,
  storm: 1.2,
};

/** Energy state to glow intensity mapping */
const ENERGY_INTENSITY: Record<ChromeEnergyState, number> = {
  dormant: 0.2,
  active: 0.6,
  pulse: 0.9,
  storm: 1.2,
};

/** Primary color for borders */
const NEON_COLOR = new THREE.Color(0x8b5cf6);

// =============================================================================
// SHADERS
// =============================================================================

const borderVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const borderFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform float uBorderRadius;
uniform float uBorderWidth;
uniform vec3 uNeonColor;
uniform float uGlowIntensity;
uniform float uAnimationSpeed;
uniform float uActive;

varying vec2 vUv;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

// Rounded rectangle SDF
float sdRoundedRect(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

// Traveling light sweep gradient
float sweepGradient(vec2 uv, float time, float speed) {
  // Calculate angle from center
  float angle = atan(uv.y, uv.x);

  // Create sweep position (0-1 around the perimeter)
  float sweep = fract(angle / TWO_PI + time * speed);

  // Main traveling light
  float light = smoothstep(0.0, 0.2, sweep) * (1.0 - smoothstep(0.2, 0.5, sweep));

  // Secondary trail
  float trail = smoothstep(0.5, 0.6, sweep) * (1.0 - smoothstep(0.6, 0.8, sweep)) * 0.3;

  return light + trail;
}

// Halation glow effect
vec4 neonHalation(float dist, vec3 color, float intensity) {
  // Core glow (sharp, bright white-tinted)
  float core = exp(-abs(dist) * 40.0) * intensity;

  // Corona glow (medium spread, colored)
  float corona = exp(-abs(dist) * 12.0) * intensity * 0.7;

  // Haze glow (wide, subtle)
  float haze = exp(-abs(dist) * 4.0) * intensity * 0.2;

  // Color mixing
  vec3 coreColor = mix(color, vec3(1.0), 0.8); // Almost white core
  vec3 coronaColor = color * 1.3;
  vec3 hazeColor = color * 0.6;

  vec3 finalColor = coreColor * core + coronaColor * corona + hazeColor * haze;
  float finalAlpha = core + corona * 0.7 + haze * 0.25;

  return vec4(finalColor, finalAlpha);
}

// Corner glow accumulation
float cornerAccumulation(vec2 uv, float radius) {
  vec2 cornerPos = vec2(
    abs(uv.x) - (1.0 - radius),
    abs(uv.y) - (1.0 - radius)
  );

  // Only accumulate in corner regions
  if (cornerPos.x > 0.0 && cornerPos.y > 0.0) {
    float cornerDist = length(cornerPos);
    return exp(-cornerDist * 15.0) * 0.3;
  }
  return 0.0;
}

void main() {
  // Center UV and apply aspect ratio
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  // Calculate rounded rect SDF
  vec2 rectSize = vec2(uAspect - uBorderWidth * 2.0, 1.0 - uBorderWidth * 2.0);
  float dist = sdRoundedRect(uv, rectSize, uBorderRadius);

  // Traveling light sweep
  float sweep = sweepGradient(uv, uTime, uAnimationSpeed);

  // Border mask (only render on border region)
  float borderOuter = smoothstep(uBorderWidth * 1.5, 0.0, dist);
  float borderInner = smoothstep(-uBorderWidth * 1.5, 0.0, dist);
  float borderMask = borderOuter * borderInner;

  // Combine traveling light with border
  float travelingLight = borderMask * (0.2 + sweep * 0.8);

  // Corner accumulation
  float corner = cornerAccumulation(uv / vec2(uAspect, 1.0), uBorderRadius * 2.0) * uGlowIntensity;

  // Get base halation glow
  vec4 glow = neonHalation(dist, uNeonColor, uGlowIntensity * uActive * 0.5);

  // Add traveling light contribution
  glow.rgb += uNeonColor * travelingLight * uActive * 1.5;
  glow.a += travelingLight * uActive;

  // Add corner accumulation
  glow.rgb += uNeonColor * corner * uActive;
  glow.a += corner * uActive * 0.5;

  // Apply activity multiplier
  glow *= uActive;

  // Clamp alpha
  glow.a = clamp(glow.a, 0.0, 1.0);

  gl_FragColor = glow;
}
`;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ChromeBorder renders a neon border effect around a panel.
 */
export function ChromeBorder({
  registration,
  viewport,
  animationSpeed,
}: ChromeBorderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { normalizedBounds, energyState, config } = registration;
  const { state: perfState } = usePerformance();

  // Skip border rendering if not enabled
  if (!config.glowBorders) {
    return null;
  }

  // Skip on low performance tiers
  if (perfState.tier === 'fallback' || perfState.tier === 'low') {
    return null;
  }

  // Calculate position and scale
  const position = useMemo(() => {
    const x = (normalizedBounds.x + normalizedBounds.width / 2) * 2 - 1;
    const y = (normalizedBounds.y + normalizedBounds.height / 2) * 2 - 1;
    return new THREE.Vector3(x, y, 0.01); // Slightly in front of panel
  }, [normalizedBounds]);

  const scale = useMemo(() => {
    // Slightly larger than panel to ensure border is visible around edges
    const padding = 0.02;
    return new THREE.Vector3(
      (normalizedBounds.width + padding) * 2,
      (normalizedBounds.height + padding) * 2,
      1
    );
  }, [normalizedBounds]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: normalizedBounds.width / normalizedBounds.height },
      uBorderRadius: { value: (config.borderRadius ?? 12) / Math.min(viewport.width, viewport.height) },
      uBorderWidth: { value: 0.015 },
      uNeonColor: { value: NEON_COLOR.clone() },
      uGlowIntensity: { value: ENERGY_INTENSITY[energyState] },
      uAnimationSpeed: { value: animationSpeed ?? ENERGY_SPEED[energyState] },
      uActive: { value: 1.0 },
    }),
    [energyState, config, viewport, normalizedBounds, animationSpeed]
  );

  // Animation frame update
  useFrame((_, delta) => {
    if (materialRef.current) {
      const u = materialRef.current.uniforms;

      // Update time
      u.uTime.value += delta;

      // Smooth transitions for energy state changes
      const targetIntensity = ENERGY_INTENSITY[energyState];
      u.uGlowIntensity.value += (targetIntensity - u.uGlowIntensity.value) * 0.1;

      const targetSpeed = animationSpeed ?? ENERGY_SPEED[energyState];
      u.uAnimationSpeed.value += (targetSpeed - u.uAnimationSpeed.value) * 0.1;
    }
  });

  // Update position and scale when bounds change
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(position);
      meshRef.current.scale.copy(scale);
    }
  }, [position, scale]);

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={borderVertexShader}
        fragmentShader={borderFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export default ChromeBorder;
