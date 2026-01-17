import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ExplosionParticles - Particle emitter for ring explosion effect
 *
 * Creates 200-300 particles that:
 * - Start positions along ring circumference
 * - Radial velocity with random spread (0.8-1.2 multiplier)
 * - Purple-to-white color gradient with fade
 * - Per-particle vertex colors for performance
 *
 * @see Phase 27-01, 27-02: Ring Explosion Effect
 */

// Design system colors
const COLORS = {
  initial: new THREE.Color('#9333EA'),  // Electric violet
  peak: new THREE.Color('#FFFFFF'),      // White hot
  fade: new THREE.Color('#E9D5FF'),      // Light purple
};

interface ExplosionParticlesProps {
  /** Whether the explosion is active */
  active: boolean;
  /** Number of particles (200-300 recommended) */
  particleCount?: number;
  /** Ring radius to spawn particles from */
  ringRadius?: number;
  /** Duration of the explosion in ms */
  duration?: number;
  /** Callback when explosion completes */
  onComplete?: () => void;
}

export function ExplosionParticles({
  active,
  particleCount = 250,
  ringRadius = 1,
  duration = 800,
  onComplete,
}: ExplosionParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  // Generate initial particle data
  const { positions, velocities, colors, sizes, initialPositions } = useMemo(() => {
    const positionsArray = new Float32Array(particleCount * 3);
    const velocitiesArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    const sizesArray = new Float32Array(particleCount);
    const initialPositionsArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Position particles along ring circumference
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;
      const z = (Math.random() - 0.5) * 0.2; // Slight Z variation

      positionsArray[i3] = x;
      positionsArray[i3 + 1] = y;
      positionsArray[i3 + 2] = z;

      // Store initial positions for reset
      initialPositionsArray[i3] = x;
      initialPositionsArray[i3 + 1] = y;
      initialPositionsArray[i3 + 2] = z;

      // Radial velocity with random spread (0.8-1.2 multiplier)
      const velocityMultiplier = 0.8 + Math.random() * 0.4;
      const baseVelocity = 3; // Base speed

      // Add some randomness to direction
      const spreadAngle = (Math.random() - 0.5) * 0.5;
      const spreadX = Math.cos(angle + spreadAngle);
      const spreadY = Math.sin(angle + spreadAngle);

      velocitiesArray[i3] = spreadX * baseVelocity * velocityMultiplier;
      velocitiesArray[i3 + 1] = spreadY * baseVelocity * velocityMultiplier;
      velocitiesArray[i3 + 2] = (Math.random() - 0.5) * baseVelocity * 0.3;

      // Initial color (electric violet)
      colorsArray[i3] = COLORS.initial.r;
      colorsArray[i3 + 1] = COLORS.initial.g;
      colorsArray[i3 + 2] = COLORS.initial.b;

      // Random particle size (0.02-0.05 units)
      sizesArray[i] = 0.02 + Math.random() * 0.03;
    }

    return {
      positions: positionsArray,
      velocities: velocitiesArray,
      colors: colorsArray,
      sizes: sizesArray,
      initialPositions: initialPositionsArray,
    };
  }, [particleCount, ringRadius]);

  // Create buffer geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, colors, sizes]);

  // Reset particles when explosion starts
  useEffect(() => {
    if (active) {
      startTimeRef.current = 0;
      hasCompletedRef.current = false;

      // Reset positions
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        posAttr.array[i3] = initialPositions[i3];
        posAttr.array[i3 + 1] = initialPositions[i3 + 1];
        posAttr.array[i3 + 2] = initialPositions[i3 + 2];

        // Reset to initial color
        colorAttr.array[i3] = COLORS.initial.r;
        colorAttr.array[i3 + 1] = COLORS.initial.g;
        colorAttr.array[i3 + 2] = COLORS.initial.b;
      }

      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }
  }, [active, geometry, particleCount, initialPositions]);

  // Animation frame
  useFrame((state, delta) => {
    if (!active || !pointsRef.current) return;

    // Track elapsed time
    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = (state.clock.elapsedTime - startTimeRef.current) * 1000;
    const progress = Math.min(elapsed / duration, 1);

    // Check if explosion is complete
    if (progress >= 1 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
      return;
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    // Easing function for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Update positions with velocity (decelerate over time)
      const velocityFactor = 1 - easeOut * 0.8; // Slow down to 20% at end
      posAttr.array[i3] += velocities[i3] * delta * velocityFactor;
      posAttr.array[i3 + 1] += velocities[i3 + 1] * delta * velocityFactor;
      posAttr.array[i3 + 2] += velocities[i3 + 2] * delta * velocityFactor;

      // Color transition: initial -> peak -> fade
      let r: number, g: number, b: number;

      if (progress < 0.3) {
        // Initial to peak (purple to white)
        const t = progress / 0.3;
        r = THREE.MathUtils.lerp(COLORS.initial.r, COLORS.peak.r, t);
        g = THREE.MathUtils.lerp(COLORS.initial.g, COLORS.peak.g, t);
        b = THREE.MathUtils.lerp(COLORS.initial.b, COLORS.peak.b, t);
      } else {
        // Peak to fade (white to light purple)
        const t = (progress - 0.3) / 0.7;
        r = THREE.MathUtils.lerp(COLORS.peak.r, COLORS.fade.r, t);
        g = THREE.MathUtils.lerp(COLORS.peak.g, COLORS.fade.g, t);
        b = THREE.MathUtils.lerp(COLORS.peak.b, COLORS.fade.b, t);
      }

      colorAttr.array[i3] = r;
      colorAttr.array[i3 + 1] = g;
      colorAttr.array[i3 + 2] = b;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Update material opacity for fade out
    if (pointsRef.current.material instanceof THREE.PointsMaterial) {
      pointsRef.current.material.opacity = 1 - Math.pow(progress, 2);
    }
  });

  if (!active) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default ExplosionParticles;
