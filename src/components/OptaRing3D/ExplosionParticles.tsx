import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ExplosionParticles - Particle System for Ring Explosion Effect
 *
 * A high-performance particle emitter that creates a radial burst from the ring.
 * Uses vertex colors and BufferGeometry for efficient GPU rendering.
 *
 * ## Visual Behavior
 * - 200-300 particles spawn along the ring circumference
 * - Radial velocity with 0.8-1.2 random spread multiplier
 * - Color transition: electric violet -> white hot -> light purple
 * - Opacity fade-out with quadratic easing
 *
 * ## Performance Optimizations
 * - Single BufferGeometry with position, color, size attributes
 * - Per-particle vertex colors (no texture lookups)
 * - Additive blending for bright overlap effects
 * - Memoized geometry with proper cleanup on unmount
 *
 * @see Phase 27-01, 27-02: Ring Explosion Effect
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring (exploding state)
 */

// =============================================================================
// COLOR CONSTANTS (Design System)
// =============================================================================

/** Particle color palette matching design system */
const PARTICLE_COLORS = {
  /** Initial burst color: electric violet */
  initial: new THREE.Color('#9333EA'),
  /** Peak intensity: white hot center */
  peak: new THREE.Color('#FFFFFF'),
  /** Fade-out: light purple trail */
  fade: new THREE.Color('#E9D5FF'),
} as const;

// =============================================================================
// ANIMATION CONSTANTS
// =============================================================================

/** Base particle velocity in world units per second */
const BASE_VELOCITY = 3;

/** Velocity randomness range [0.8, 1.2] multiplier */
const VELOCITY_MIN_MULT = 0.8;
const VELOCITY_RANGE = 0.4; // max = 0.8 + 0.4 = 1.2

/** Angular spread for velocity direction (radians) */
const VELOCITY_SPREAD_RADIANS = 0.5;

/** Z-axis velocity multiplier (less than radial) */
const Z_VELOCITY_MULT = 0.3;

/** Initial Z-position variation range */
const Z_POSITION_VARIATION = 0.2;

/** Angular position variation for natural distribution */
const ANGLE_VARIATION = 0.3;

/** Particle size range [min, max] in world units */
const PARTICLE_SIZE_MIN = 0.02;
const PARTICLE_SIZE_RANGE = 0.03;

/** Color transition breakpoint (0-1) where initial->peak becomes peak->fade */
const COLOR_TRANSITION_POINT = 0.3;

/** Velocity deceleration factor at animation end */
const END_VELOCITY_FACTOR = 0.2; // Slows to 20% at end

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ExplosionParticles component.
 */
interface ExplosionParticlesProps {
  /** Whether the explosion effect is currently active */
  active: boolean;

  /**
   * Number of particles to emit. 200-300 provides good visual density
   * while maintaining 60fps on most hardware.
   * @default 250
   */
  particleCount?: number;

  /**
   * Ring radius determining initial particle spawn positions.
   * Particles spawn along the circumference at this radius.
   * @default 1
   */
  ringRadius?: number;

  /**
   * Total duration of the explosion animation in milliseconds.
   * @default 800
   */
  duration?: number;

  /** Callback fired when all particles have completed their animation */
  onComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExplosionParticles({
  active,
  particleCount = 250,
  ringRadius = 1,
  duration = 800,
  onComplete,
}: ExplosionParticlesProps): React.ReactNode {
  // Refs for Three.js objects and animation state
  const pointsRef = useRef<THREE.Points>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  /**
   * Generate initial particle data arrays.
   * Memoized to only recalculate when particle count or radius changes.
   */
  const { positions, velocities, colors, sizes, initialPositions } = useMemo(() => {
    // Pre-allocate typed arrays for performance
    const positionsArray = new Float32Array(particleCount * 3);
    const velocitiesArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    const sizesArray = new Float32Array(particleCount);
    const initialPositionsArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const index3 = i * 3; // 3-component index (x, y, z)

      // Distribute particles along ring circumference with slight variation
      const baseAngle = (i / particleCount) * Math.PI * 2;
      const angleVariation = (Math.random() - 0.5) * ANGLE_VARIATION;
      const angle = baseAngle + angleVariation;

      // Initial position on ring circumference
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;
      const z = (Math.random() - 0.5) * Z_POSITION_VARIATION;

      positionsArray[index3] = x;
      positionsArray[index3 + 1] = y;
      positionsArray[index3 + 2] = z;

      // Store initial positions for reset on re-trigger
      initialPositionsArray[index3] = x;
      initialPositionsArray[index3 + 1] = y;
      initialPositionsArray[index3 + 2] = z;

      // Calculate radial velocity with randomized spread
      const velocityMultiplier = VELOCITY_MIN_MULT + Math.random() * VELOCITY_RANGE;
      const spreadAngle = (Math.random() - 0.5) * VELOCITY_SPREAD_RADIANS;
      const velocityDirection = angle + spreadAngle;

      velocitiesArray[index3] = Math.cos(velocityDirection) * BASE_VELOCITY * velocityMultiplier;
      velocitiesArray[index3 + 1] = Math.sin(velocityDirection) * BASE_VELOCITY * velocityMultiplier;
      velocitiesArray[index3 + 2] = (Math.random() - 0.5) * BASE_VELOCITY * Z_VELOCITY_MULT;

      // Initial color: electric violet
      colorsArray[index3] = PARTICLE_COLORS.initial.r;
      colorsArray[index3 + 1] = PARTICLE_COLORS.initial.g;
      colorsArray[index3 + 2] = PARTICLE_COLORS.initial.b;

      // Random particle size for visual variety
      sizesArray[i] = PARTICLE_SIZE_MIN + Math.random() * PARTICLE_SIZE_RANGE;
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

  // Cleanup geometry on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

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
        colorAttr.array[i3] = PARTICLE_COLORS.initial.r;
        colorAttr.array[i3 + 1] = PARTICLE_COLORS.initial.g;
        colorAttr.array[i3 + 2] = PARTICLE_COLORS.initial.b;
      }

      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }
  }, [active, geometry, particleCount, initialPositions]);

  // Animation frame loop
  useFrame((state, delta) => {
    if (!active || !pointsRef.current) return;

    // Initialize start time on first frame
    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    // Calculate animation progress (0 to 1)
    const elapsedMs = (state.clock.elapsedTime - startTimeRef.current) * 1000;
    const progress = Math.min(elapsedMs / duration, 1);

    // Fire completion callback once at end
    if (progress >= 1 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
      return;
    }

    // Get buffer attributes for direct manipulation
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    // Cubic ease-out for smooth deceleration
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);

    // Calculate current velocity factor (decelerates to 20% at end)
    const velocityFactor = 1 - easeOutCubic * (1 - END_VELOCITY_FACTOR);

    // Update each particle
    for (let i = 0; i < particleCount; i++) {
      const index3 = i * 3;

      // Update position with velocity and deceleration
      posAttr.array[index3] += velocities[index3] * delta * velocityFactor;
      posAttr.array[index3 + 1] += velocities[index3 + 1] * delta * velocityFactor;
      posAttr.array[index3 + 2] += velocities[index3 + 2] * delta * velocityFactor;

      // Calculate color transition based on progress
      let r: number, g: number, b: number;

      if (progress < COLOR_TRANSITION_POINT) {
        // Phase 1: Initial violet -> white hot peak
        const t = progress / COLOR_TRANSITION_POINT;
        r = THREE.MathUtils.lerp(PARTICLE_COLORS.initial.r, PARTICLE_COLORS.peak.r, t);
        g = THREE.MathUtils.lerp(PARTICLE_COLORS.initial.g, PARTICLE_COLORS.peak.g, t);
        b = THREE.MathUtils.lerp(PARTICLE_COLORS.initial.b, PARTICLE_COLORS.peak.b, t);
      } else {
        // Phase 2: White hot peak -> light purple fade
        const t = (progress - COLOR_TRANSITION_POINT) / (1 - COLOR_TRANSITION_POINT);
        r = THREE.MathUtils.lerp(PARTICLE_COLORS.peak.r, PARTICLE_COLORS.fade.r, t);
        g = THREE.MathUtils.lerp(PARTICLE_COLORS.peak.g, PARTICLE_COLORS.fade.g, t);
        b = THREE.MathUtils.lerp(PARTICLE_COLORS.peak.b, PARTICLE_COLORS.fade.b, t);
      }

      colorAttr.array[index3] = r;
      colorAttr.array[index3 + 1] = g;
      colorAttr.array[index3 + 2] = b;
    }

    // Flag attributes for GPU update
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Quadratic fade-out for material opacity
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
