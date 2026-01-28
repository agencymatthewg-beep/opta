/**
 * EnergyReactor - Living Energy Management System
 *
 * Core component that brings the chrome system to life through:
 * - Real-time energy calculation from system telemetry
 * - Visual energy particles flowing between panels
 * - Global energy state management
 * - Energy bursts on significant system activity
 *
 * Architecture:
 * - Monitors CPU, memory, GPU utilization
 * - Calculates composite energy level
 * - Broadcasts state to all chrome panels
 * - Renders optional energy particle effects
 *
 * Energy States:
 * | State   | Trigger              | Visual Effect                    |
 * |---------|----------------------|----------------------------------|
 * | dormant | Idle (<20% load)     | Subtle glass, slow borders       |
 * | active  | Light use (20-50%)   | Brighter, faster animations      |
 * | pulse   | Data update spike    | Energy burst, temporary          |
 * | storm   | High load (>80%)     | Intense glow, particles, shake   |
 *
 * @see useChromePanelEnergy.ts - Individual panel energy hook
 * @see ChromeContext.tsx - Chrome state provider
 * @see ChromeCanvas.tsx - WebGL chrome renderer
 */

import { useEffect, useMemo, useRef, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGlobalEnergy, type EnergyConfig } from '@/hooks/useChromePanelEnergy';
import { useChromeOptional } from '@/contexts/ChromeContext';
import type { ChromeEnergyState } from './ChromeRegistry';

// =============================================================================
// TYPES
// =============================================================================

export interface EnergyReactorProps {
  /** Custom energy calculation config */
  config?: Partial<EnergyConfig>;
  /** Enable particle effects */
  particles?: boolean;
  /** Maximum particle count */
  maxParticles?: number;
  /** Particle color (hex) */
  particleColor?: number;
  /** Debug mode */
  debug?: boolean;
}

interface EnergyParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  energy: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Particle emission rates per energy state */
const EMISSION_RATES: Record<ChromeEnergyState, number> = {
  dormant: 0.5,
  active: 2,
  pulse: 8,
  storm: 15,
};

/** Particle speeds per energy state */
const PARTICLE_SPEEDS: Record<ChromeEnergyState, number> = {
  dormant: 0.001,
  active: 0.003,
  pulse: 0.008,
  storm: 0.015,
};

/** Glow intensities per energy state */
const GLOW_INTENSITY: Record<ChromeEnergyState, number> = {
  dormant: 0.2,
  active: 0.5,
  pulse: 0.9,
  storm: 1.0,
};

// =============================================================================
// PARTICLE SYSTEM
// =============================================================================

interface EnergyParticleSystemProps {
  energyState: ChromeEnergyState;
  energyLevel: number;
  maxParticles: number;
  particleColor: number;
}

/**
 * GPU particle system for energy visualization
 */
const EnergyParticleSystem = memo(function EnergyParticleSystem({
  energyState,
  energyLevel,
  maxParticles,
  particleColor,
}: EnergyParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleDataRef = useRef<EnergyParticle[]>([]);
  const emissionAccumulator = useRef(0);
  const { viewport } = useThree();

  // Initialize particle geometry
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    const alphas = new Float32Array(maxParticles);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(particleColor) },
        uGlowIntensity: { value: GLOW_INTENSITY[energyState] },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          vAlpha = alpha;
          vColor = color;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform float uGlowIntensity;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);

          // Soft circle with glow
          float alpha = smoothstep(0.5, 0.0, dist);
          float glow = exp(-dist * 3.0) * uGlowIntensity;

          vec3 color = mix(vColor, uBaseColor, 0.3);
          color += vec3(glow * 0.5);

          gl_FragColor = vec4(color, alpha * vAlpha * (0.5 + glow));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    return { geometry: geo, material: mat };
  }, [maxParticles, particleColor, energyState]);

  // Create new particle
  const createParticle = (): EnergyParticle => {
    // Spawn from edges of viewport
    const spawnEdge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    switch (spawnEdge) {
      case 0: // Top
        x = (Math.random() - 0.5) * viewport.width;
        y = viewport.height / 2;
        break;
      case 1: // Right
        x = viewport.width / 2;
        y = (Math.random() - 0.5) * viewport.height;
        break;
      case 2: // Bottom
        x = (Math.random() - 0.5) * viewport.width;
        y = -viewport.height / 2;
        break;
      case 3: // Left
        x = -viewport.width / 2;
        y = (Math.random() - 0.5) * viewport.height;
        break;
    }

    // Velocity towards center with some variation
    const toCenter = new THREE.Vector3(-x, -y, 0).normalize();
    const speed = PARTICLE_SPEEDS[energyState] * (0.5 + Math.random());

    return {
      position: new THREE.Vector3(x, y, 0),
      velocity: toCenter.multiplyScalar(speed).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
          0
        )
      ),
      life: 1.0,
      maxLife: 2 + Math.random() * 3,
      size: 2 + Math.random() * 4 * (energyLevel / 100),
      energy: energyLevel / 100,
    };
  };

  // Animation loop
  useFrame((state, delta) => {
    if (!particlesRef.current) return;

    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;
    const sizes = geometry.attributes.size.array as Float32Array;
    const alphas = geometry.attributes.alpha.array as Float32Array;
    const particles = particleDataRef.current;

    // Update material uniforms
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uGlowIntensity.value = GLOW_INTENSITY[energyState];

    // Emit new particles
    const emissionRate = EMISSION_RATES[energyState];
    emissionAccumulator.current += emissionRate * delta;

    while (emissionAccumulator.current >= 1 && particles.length < maxParticles) {
      particles.push(createParticle());
      emissionAccumulator.current -= 1;
    }

    // Update existing particles
    const baseColor = new THREE.Color(particleColor);

    for (let i = 0; i < maxParticles; i++) {
      if (i < particles.length) {
        const p = particles[i];

        // Update life
        p.life -= delta / p.maxLife;

        if (p.life <= 0) {
          // Respawn particle
          particles[i] = createParticle();
          continue;
        }

        // Update position
        p.position.add(p.velocity.clone().multiplyScalar(delta * 60));

        // Add some orbital motion around center
        const toCenter = new THREE.Vector3(-p.position.x, -p.position.y, 0);
        const dist = toCenter.length();
        if (dist > 0.1) {
          const perpendicular = new THREE.Vector3(-toCenter.y, toCenter.x, 0).normalize();
          p.velocity.add(perpendicular.multiplyScalar(0.00005 * p.energy));
        }

        // Update buffers
        positions[i * 3] = p.position.x;
        positions[i * 3 + 1] = p.position.y;
        positions[i * 3 + 2] = p.position.z;

        // Color based on energy
        const energyColor = baseColor.clone().multiplyScalar(0.5 + p.energy * 0.5);
        colors[i * 3] = energyColor.r;
        colors[i * 3 + 1] = energyColor.g;
        colors[i * 3 + 2] = energyColor.b;

        sizes[i] = p.size * (0.5 + p.life * 0.5);
        alphas[i] = p.life * p.energy;
      } else {
        // Hidden particle
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = -100;
        alphas[i] = 0;
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <points ref={particlesRef} geometry={geometry} material={material} />
  );
});

// =============================================================================
// ENERGY CORE
// =============================================================================

interface EnergyCoreProps {
  energyState: ChromeEnergyState;
  energyLevel: number;
}

/**
 * Central energy core visual - pulsing orb at center
 */
const EnergyCore = memo(function EnergyCore({
  energyState,
  energyLevel,
}: EnergyCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Core shader
  const { uniforms, vertexShader, fragmentShader } = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: energyLevel / 100 },
      uState: { value: GLOW_INTENSITY[energyState] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uEnergy;
      uniform float uState;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center);

        // Pulsing glow
        float pulse = sin(uTime * 2.0 + dist * 10.0) * 0.5 + 0.5;
        float glow = exp(-dist * 4.0) * (0.5 + pulse * 0.5) * uState;

        // Energy color gradient
        vec3 coreColor = vec3(0.545, 0.361, 0.965); // Purple
        vec3 hotColor = vec3(0.659, 0.333, 0.969); // Lighter purple
        vec3 color = mix(coreColor, hotColor, uEnergy * pulse);

        // Fresnel rim
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        color += vec3(fresnel * 0.3 * uState);

        float alpha = glow * uEnergy * 0.8;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), [energyState, energyLevel]);

  // Animate
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // Smooth energy transitions
      const targetEnergy = energyLevel / 100;
      materialRef.current.uniforms.uEnergy.value +=
        (targetEnergy - materialRef.current.uniforms.uEnergy.value) * 0.05;
      materialRef.current.uniforms.uState.value = GLOW_INTENSITY[energyState];
    }

    // Subtle scale pulsing
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      const baseScale = 0.1 + (energyLevel / 100) * 0.1;
      meshRef.current.scale.setScalar(baseScale + pulse * GLOW_INTENSITY[energyState]);
    }
  });

  // Don't render if dormant
  if (energyState === 'dormant' && energyLevel < 20) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, -0.1]}>
      <circleGeometry args={[1, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
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
 * EnergyReactor - Living Energy Management System
 *
 * Place inside ChromeCanvas's <Suspense> to add energy effects.
 *
 * @example
 * ```tsx
 * <ChromeCanvas>
 *   <Suspense fallback={null}>
 *     <ChromeScene />
 *     <EnergyReactor particles />
 *   </Suspense>
 * </ChromeCanvas>
 * ```
 */
export function EnergyReactor({
  config,
  particles = true,
  maxParticles = 100,
  particleColor = 0x8b5cf6, // Opta purple
  debug = false,
}: EnergyReactorProps) {
  const chromeContext = useChromeOptional();
  const { metrics, globalEnergyState } = useGlobalEnergy(config);

  // Don't render if chrome is disabled
  if (!chromeContext?.state.isEnabled) return null;

  return (
    <group name="energy-reactor">
      {/* Central energy core */}
      <EnergyCore
        energyState={globalEnergyState}
        energyLevel={metrics.level}
      />

      {/* Particle system */}
      {particles && (
        <EnergyParticleSystem
          energyState={globalEnergyState}
          energyLevel={metrics.level}
          maxParticles={maxParticles}
          particleColor={particleColor}
        />
      )}

      {/* Debug info */}
      {debug && (
        <group position={[0, -1.5, 0]}>
          {/* Debug text would go here - omitted for simplicity */}
        </group>
      )}
    </group>
  );
}

export default EnergyReactor;
