/**
 * AtmosphericFogWebGL - GPU-Rendered Fog System
 *
 * WebGL implementation of atmospheric fog for the chrome system.
 * Renders multi-layer fog with volumetric shaders for premium depth effects.
 *
 * Features:
 * - Real-time GLSL fog simulation
 * - Integration with chrome energy states
 * - Intensity-based opacity and movement
 * - Breathing animation synchronized with energy
 *
 * @see AtmosphericFog.tsx - CSS fallback version
 * @see FogContext.tsx - Fog state management
 */

import { useRef, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFogOptional, type FogIntensity } from '@/contexts/FogContext';
import { useChromeOptional } from '@/contexts/ChromeContext';
import type { ChromeEnergyState } from './ChromeRegistry';

// =============================================================================
// TYPES
// =============================================================================

export interface AtmosphericFogWebGLProps {
  /** Fog intensity override (uses FogContext if not provided) */
  intensity?: FogIntensity;
  /** Custom opacity override (0-1) */
  opacity?: number;
  /** Enable fog (uses FogContext if not provided) */
  enabled?: boolean;
  /** Number of fog layers */
  layers?: number;
  /** Base fog color (hex) */
  color?: number;
  /** Enable debug visualization */
  debug?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Intensity to opacity mapping - reduced for subtler effect */
const INTENSITY_OPACITY: Record<FogIntensity, number> = {
  idle: 0.03,
  active: 0.08,
  storm: 0.15,
};

/** Intensity to animation speed mapping */
const INTENSITY_SPEED: Record<FogIntensity, number> = {
  idle: 0.02,
  active: 0.05,
  storm: 0.12,
};

/** Energy state to intensity mapping */
const ENERGY_TO_INTENSITY: Record<ChromeEnergyState, FogIntensity> = {
  dormant: 'idle',
  active: 'active',
  pulse: 'active',
  storm: 'storm',
};

// =============================================================================
// FOG LAYER SHADER
// =============================================================================

const fogVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fogFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform vec3 uColor;
uniform float uLayerIndex;
uniform float uLayerCount;
uniform vec2 uResolution;

varying vec2 vUv;
varying vec3 vPosition;

// Simplex noise functions
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

void main() {
  // Layer-specific parameters
  float layerDepth = uLayerIndex / uLayerCount;
  float layerSpeed = uSpeed * (1.0 - layerDepth * 0.5);
  float layerScale = 1.0 + layerDepth * 2.0;

  // Animated UV with layer offset
  vec2 uv = vUv;
  uv.x += uTime * layerSpeed * 0.1;
  uv.y += sin(uTime * layerSpeed * 0.5) * 0.05;

  // Multi-octave noise for volumetric feel
  float noise1 = fbm(uv * layerScale + uTime * layerSpeed * 0.3, 4);
  float noise2 = fbm(uv * layerScale * 1.5 - uTime * layerSpeed * 0.2, 3);
  float noise3 = fbm(uv * layerScale * 0.5 + vec2(uTime * layerSpeed * 0.1, 0.0), 2);

  // Combine noise layers
  float fog = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2) * 0.5 + 0.5;

  // Radial gradient from center
  vec2 center = vUv - 0.5;
  float radialDist = length(center);
  float radialGradient = smoothstep(0.8, 0.2, radialDist);

  // Apply radial gradient to fog
  fog *= radialGradient;

  // Breathing animation
  float breathing = sin(uTime * 0.5 + layerDepth * 3.14159) * 0.1 + 0.9;
  fog *= breathing;

  // Intensity modulation
  float finalOpacity = fog * uIntensity * (1.0 - layerDepth * 0.3);

  // Color with slight hue shift per layer
  vec3 fogColor = uColor;
  fogColor.r += sin(layerDepth * 3.14159) * 0.1;
  fogColor.b += cos(layerDepth * 3.14159) * 0.1;

  // Add subtle glow at center
  float centerGlow = exp(-radialDist * 3.0) * uIntensity * 0.3;
  fogColor += vec3(0.2, 0.1, 0.3) * centerGlow;

  gl_FragColor = vec4(fogColor, finalOpacity);
}
`;

// =============================================================================
// FOG LAYER COMPONENT
// =============================================================================

interface FogLayerMeshProps {
  index: number;
  totalLayers: number;
  intensity: FogIntensity;
  opacity: number;
  color: THREE.Color;
}

const FogLayerMesh = memo(function FogLayerMesh({
  index,
  totalLayers,
  intensity,
  opacity,
  color,
}: FogLayerMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  // Create uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: INTENSITY_OPACITY[intensity] * opacity },
      uSpeed: { value: INTENSITY_SPEED[intensity] },
      uColor: { value: color },
      uLayerIndex: { value: index },
      uLayerCount: { value: totalLayers },
      uResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
    }),
    [intensity, opacity, color, index, totalLayers, viewport]
  );

  // Animation loop
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

      // Smooth intensity transitions
      const targetIntensity = INTENSITY_OPACITY[intensity] * opacity;
      materialRef.current.uniforms.uIntensity.value +=
        (targetIntensity - materialRef.current.uniforms.uIntensity.value) * 0.05;

      materialRef.current.uniforms.uSpeed.value = INTENSITY_SPEED[intensity];
    }
  });

  // Layer depth for parallax
  const depth = -0.1 - index * 0.05;

  return (
    <mesh ref={meshRef} position={[0, 0, depth]}>
      <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={fogVertexShader}
        fragmentShader={fogFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
});

// =============================================================================
// CENTRAL GLOW
// =============================================================================

interface CentralGlowProps {
  intensity: FogIntensity;
}

const CentralGlow = memo(function CentralGlow({ intensity }: CentralGlowProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: INTENSITY_OPACITY[intensity] },
    }),
    [intensity]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

      const targetIntensity = INTENSITY_OPACITY[intensity];
      materialRef.current.uniforms.uIntensity.value +=
        (targetIntensity - materialRef.current.uniforms.uIntensity.value) * 0.05;
    }

    // Scale pulse for storm intensity
    if (meshRef.current && intensity === 'storm') {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -0.2]}>
      <circleGeometry args={[2, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          uniform float uIntensity;
          varying vec2 vUv;

          void main() {
            vec2 center = vUv - 0.5;
            float dist = length(center);

            // Pulsing glow
            float pulse = sin(uTime * 0.8) * 0.2 + 0.8;

            // Radial gradient
            float glow = exp(-dist * 2.0) * uIntensity * pulse;

            // Purple-ish color
            vec3 color = vec3(0.659, 0.333, 0.969) * glow;

            gl_FragColor = vec4(color, glow * 0.5);
          }
        `}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * AtmosphericFogWebGL - WebGL fog for the chrome system
 *
 * Place inside ChromeCanvas's <Suspense> to add GPU-rendered fog.
 *
 * @example
 * ```tsx
 * <ChromeCanvas>
 *   <Suspense fallback={null}>
 *     <ChromeScene />
 *     <AtmosphericFogWebGL />
 *   </Suspense>
 * </ChromeCanvas>
 * ```
 */
export function AtmosphericFogWebGL({
  intensity: intensityOverride,
  opacity: opacityOverride,
  enabled: enabledOverride,
  layers = 3,
  color = 0xa855f7, // Opta purple
  debug: _debug = false,
}: AtmosphericFogWebGLProps) {
  // Note: _debug reserved for future debug visualization
  const fogContext = useFogOptional();
  const chromeContext = useChromeOptional();

  // Determine values from props or context
  const intensity = intensityOverride ?? fogContext?.intensity ?? 'idle';
  const opacity = opacityOverride ?? fogContext?.customOpacity ?? 1;
  const enabled = enabledOverride ?? fogContext?.enabled ?? true;

  // Sync with chrome energy state if available
  const energyBasedIntensity = chromeContext?.state.globalEnergyState
    ? ENERGY_TO_INTENSITY[chromeContext.state.globalEnergyState]
    : intensity;

  // Use energy-based intensity if no explicit override
  const finalIntensity = intensityOverride ? intensity : energyBasedIntensity;

  // Don't render if disabled or chrome not enabled
  if (!enabled) return null;
  if (chromeContext && !chromeContext.state.isEnabled) return null;

  const fogColor = new THREE.Color(color);

  return (
    <group name="atmospheric-fog-webgl">
      {/* Fog layers */}
      {Array.from({ length: layers }).map((_, i) => (
        <FogLayerMesh
          key={`fog-layer-${i}`}
          index={i}
          totalLayers={layers}
          intensity={finalIntensity}
          opacity={opacity}
          color={fogColor}
        />
      ))}

      {/* Central glow */}
      <CentralGlow intensity={finalIntensity} />
    </group>
  );
}

export default AtmosphericFogWebGL;
