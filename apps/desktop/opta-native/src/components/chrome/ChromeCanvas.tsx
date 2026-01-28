/**
 * ChromeCanvas - WebGL Chrome Rendering Layer
 *
 * Full-screen WebGL canvas that renders GPU glass panels, borders,
 * and glows behind the HTML content layer.
 *
 * Architecture:
 * - Renders at z-index 0 (between background -10 and content 10+)
 * - Syncs panel geometry with DOM positions via useFrame
 * - Scales features based on performance tier
 *
 * @see ChromeContext.tsx - State provider
 * @see ChromePanel.tsx - Individual glass panel mesh
 * @see DESIGN_SYSTEM.md - Glass Effects Guidelines
 */

import { useRef, useEffect, useMemo, useState, Suspense, Component, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { useChrome } from '@/contexts/ChromeContext';
import { usePerformance } from '@/contexts/PerformanceContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isWebGLAvailable } from '@/lib/shaders';
import type { ChromePanelRegistration, ChromeEnergyState } from './ChromeRegistry';
import { ChromeBorder } from './ChromeBorder';
import { EnergyReactor } from './EnergyReactor';
import { AtmosphericFogWebGL } from './AtmosphericFogWebGL';
import { ChromePostProcessing } from './ChromePostProcessing';

// =============================================================================
// ERROR BOUNDARY FOR WEBGL
// =============================================================================

interface WebGLErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary that catches WebGL/Three.js errors and falls back to CSS glass.
 * This prevents the entire app from crashing when WebGL context is lost.
 */
class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  WebGLErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ChromeCanvas] WebGL error caught, falling back to CSS:', error.message);
    console.debug('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Return fallback (CSS glass) or nothing - panels use CSS fallback automatically
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface ChromeCanvasProps {
  /** Additional CSS classes */
  className?: string;
  /** Enable debug visualization */
  debug?: boolean;
  /** Z-index override */
  zIndex?: number;
  /** Enable energy reactor particles */
  enableEnergyReactor?: boolean;
  /** Max particles for energy reactor */
  maxParticles?: number;
  /** Enable WebGL atmospheric fog */
  enableFog?: boolean;
  /** Number of fog layers */
  fogLayers?: number;
  /** Enable post-processing effects */
  enablePostProcessing?: boolean;
}

interface ChromePanelMeshProps {
  registration: ChromePanelRegistration;
  viewport: { width: number; height: number };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Z-index for chrome canvas layer */
const CHROME_Z_INDEX = 0;

/** Energy state colors */
const ENERGY_COLORS: Record<ChromeEnergyState, THREE.Color> = {
  dormant: new THREE.Color(0x8b5cf6).multiplyScalar(0.3),
  active: new THREE.Color(0x8b5cf6).multiplyScalar(0.6),
  pulse: new THREE.Color(0xa855f7),
  storm: new THREE.Color(0xc084fc),
};

/** Energy state glow intensities */
const ENERGY_GLOW: Record<ChromeEnergyState, number> = {
  dormant: 0.1,
  active: 0.3,
  pulse: 0.6,
  storm: 1.0,
};

// =============================================================================
// GLASS PANEL MESH
// =============================================================================

/**
 * Individual glass panel rendered as WebGL mesh
 */
function ChromePanelMesh({ registration, viewport }: ChromePanelMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { normalizedBounds, energyState, config } = registration;

  // Convert normalized bounds to Three.js coordinates
  // Three.js uses center-based positioning, NDC space (-1 to 1)
  const position = useMemo(() => {
    const x = (normalizedBounds.x + normalizedBounds.width / 2) * 2 - 1;
    const y = (normalizedBounds.y + normalizedBounds.height / 2) * 2 - 1;
    return new THREE.Vector3(x, y, config.depth ?? 0);
  }, [normalizedBounds, config.depth]);

  const scale = useMemo(() => {
    return new THREE.Vector3(
      normalizedBounds.width * 2,
      normalizedBounds.height * 2,
      1
    );
  }, [normalizedBounds]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: ENERGY_GLOW[energyState] },
      uEnergyColor: { value: ENERGY_COLORS[energyState] },
      uBorderRadius: { value: (config.borderRadius ?? 12) / Math.min(viewport.width, viewport.height) },
      uBlurIntensity: { value: config.blurIntensity ?? 0.5 },
      uAspect: { value: normalizedBounds.width / normalizedBounds.height },
      uGlowBorders: { value: config.glowBorders ? 1.0 : 0.0 },
    }),
    [energyState, config, viewport, normalizedBounds]
  );

  // Animate shader
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // Smooth energy transitions
      const targetEnergy = ENERGY_GLOW[energyState];
      materialRef.current.uniforms.uEnergy.value +=
        (targetEnergy - materialRef.current.uniforms.uEnergy.value) * 0.1;
    }
  });

  // Update position/scale when bounds change
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
        vertexShader={glassPanelVertexShader}
        fragmentShader={glassPanelFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// =============================================================================
// SHADERS
// =============================================================================

const glassPanelVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glassPanelFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uEnergy;
uniform vec3 uEnergyColor;
uniform float uBorderRadius;
uniform float uBlurIntensity;
uniform float uAspect;
uniform float uGlowBorders;

varying vec2 vUv;

// Rounded rectangle SDF
float roundedRectSDF(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

// Simplex noise for texture
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

void main() {
  // Center UV for SDF
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  // Calculate rounded rect distance
  vec2 size = vec2(uAspect, 1.0) - uBorderRadius * 2.0;
  float d = roundedRectSDF(uv, size, uBorderRadius);

  // Glass fill (very subtle)
  float fill = 1.0 - smoothstep(-0.01, 0.01, d);
  vec3 glassColor = vec3(0.05, 0.03, 0.1); // Deep purple-black

  // Border glow
  float borderDist = abs(d);
  float borderGlow = uGlowBorders * exp(-borderDist * 30.0) * uEnergy;

  // Fresnel-like edge glow
  float edgeDist = length(uv);
  float fresnel = pow(1.0 - smoothstep(0.3, 1.0, edgeDist), 2.0) * uEnergy * 0.5;

  // Animated noise texture
  float noise = snoise(vUv * 100.0 + uTime * 0.2) * 0.02 * uBlurIntensity;

  // Traveling light (subtle)
  float travelPos = fract(uTime * 0.3);
  float travelLight = 0.0;
  if (uGlowBorders > 0.5) {
    float perimeterPos = 0.0;
    if (vUv.y > 0.98) perimeterPos = vUv.x;
    else if (vUv.x > 0.98) perimeterPos = 1.0 + (1.0 - vUv.y);
    else if (vUv.y < 0.02) perimeterPos = 2.0 + (1.0 - vUv.x);
    else if (vUv.x < 0.02) perimeterPos = 3.0 + vUv.y;
    perimeterPos /= 4.0;
    travelLight = exp(-pow((perimeterPos - travelPos) * 10.0, 2.0)) * uEnergy * 0.5;
  }

  // Combine
  vec3 finalColor = glassColor * fill;
  finalColor += uEnergyColor * (borderGlow + fresnel + travelLight);
  finalColor += vec3(noise);

  // Alpha
  float alpha = fill * 0.15 + borderGlow * 0.8 + fresnel * 0.3 + travelLight * 0.5;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// =============================================================================
// CHROME SCENE
// =============================================================================

interface ChromeSceneProps {
  debug?: boolean;
  enableEnergyReactor?: boolean;
  maxParticles?: number;
  enableFog?: boolean;
  fogLayers?: number;
  enablePostProcessing?: boolean;
}

function ChromeScene({
  debug,
  enableEnergyReactor = true,
  maxParticles = 100,
  enableFog = true,
  fogLayers = 3,
  enablePostProcessing = true,
}: ChromeSceneProps) {
  const { helpers, state } = useChrome();
  const [panels, setPanels] = useState<ChromePanelRegistration[]>([]);
  const panelIdsRef = useRef<string>('');

  // Subscribe to panel changes with shallow comparison to avoid unnecessary re-renders
  useEffect(() => {
    const registry = helpers.getRegistry();
    const unsubscribe = registry.subscribe((registryState) => {
      const newPanels = Array.from(registryState.panels.values());
      // Only update if panel IDs have changed (avoids re-render on position updates)
      const newIds = newPanels.map(p => p.config.id).sort().join(',');
      if (newIds !== panelIdsRef.current) {
        panelIdsRef.current = newIds;
        setPanels(newPanels);
      }
    });

    // Initial load
    const initialPanels = helpers.getPanels();
    panelIdsRef.current = initialPanels.map(p => p.config.id).sort().join(',');
    setPanels(initialPanels);

    return unsubscribe;
  }, [helpers]);

  // Debug grid
  const debugGrid = debug && (
    <gridHelper args={[20, 20, 0x444444, 0x222222]} rotation={[Math.PI / 2, 0, 0]} />
  );

  return (
    <>
      {/* Orthographic camera setup happens via Canvas camera prop */}

      {/* Debug helpers */}
      {debugGrid}

      {/* Render all registered panels */}
      {panels.map((panel) => (
        <ChromePanelMesh
          key={panel.config.id}
          registration={panel}
          viewport={state.viewport}
        />
      ))}

      {/* Render neon borders for panels with glowBorders enabled */}
      {panels
        .filter((panel) => panel.config.glowBorders)
        .map((panel) => (
          <ChromeBorder
            key={`border-${panel.config.id}`}
            registration={panel}
            viewport={state.viewport}
          />
        ))}

      {/* Energy reactor for living energy system */}
      {enableEnergyReactor && (
        <EnergyReactor
          particles
          maxParticles={maxParticles}
          debug={debug}
        />
      )}

      {/* WebGL atmospheric fog */}
      {enableFog && (
        <AtmosphericFogWebGL
          layers={fogLayers}
          debug={debug}
        />
      )}

      {/* Post-processing effects (bloom, chromatic, vignette) */}
      {enablePostProcessing && <ChromePostProcessing />}
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChromeCanvas({
  className,
  debug = false,
  zIndex = CHROME_Z_INDEX,
  enableEnergyReactor = true,
  maxParticles = 100,
  enableFog = true,
  fogLayers = 3,
  enablePostProcessing = true,
}: ChromeCanvasProps) {
  const { state } = useChrome();
  const { state: perfState } = usePerformance();
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Don't render if WebGL unavailable or chrome disabled
  if (!webGLAvailable || !state.isEnabled || state.isFallbackMode) {
    return null;
  }

  // Don't render if not ready
  if (!state.isReady) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        'fixed inset-0 overflow-hidden pointer-events-none',
        className
      )}
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <WebGLErrorBoundary>
        <Canvas
          className="absolute inset-0"
          orthographic
          camera={{
            zoom: 1,
            position: [0, 0, 100],
            near: 0.1,
            far: 1000,
          }}
          gl={{
            alpha: true,
            antialias: perfState.tier === 'high',
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: true,
          }}
          dpr={Math.min(window.devicePixelRatio, perfState.tier === 'high' ? 2 : 1.5)}
          style={{ background: 'transparent' }}
          frameloop={prefersReducedMotion ? 'demand' : 'always'}
        >
          <Suspense fallback={null}>
            <ChromeScene
              debug={debug}
              enableEnergyReactor={enableEnergyReactor}
              maxParticles={maxParticles}
              enableFog={enableFog}
              fogLayers={fogLayers}
              enablePostProcessing={enablePostProcessing}
            />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>

      {/* Debug overlay */}
      {debug && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-mono rounded space-y-0.5">
          <div>Chrome Panels: {state.panelCount}</div>
          <div>Energy: {state.globalEnergyState}</div>
          <div>Viewport: {state.viewport.width}x{state.viewport.height}</div>
        </div>
      )}
    </motion.div>
  );
}

export default ChromeCanvas;
