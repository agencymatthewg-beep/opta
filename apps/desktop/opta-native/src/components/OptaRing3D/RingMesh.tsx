/**
 * RingMesh - 3D Torus geometry for the Opta Ring with Wake-Up Animation
 *
 * Phase 24: 3D Ring Foundation
 * Phase 25: Glassmorphism Shader Material
 * Phase 26: Wake-Up Animation with Spring Physics
 *
 * Features:
 * - Premium torus geometry (96 radial, 64 tubular segments)
 * - Optimized tube radius 0.35 for elegant proportions
 * - Glassmorphism shader with fresnel rim lighting (Phase 25)
 * - State-driven animations with react-spring physics
 * - Subtle bob animation in dormant state
 * - Memoized geometry for performance
 *
 * Phase 25 Shader Features:
 * - Fresnel rim lighting based on view angle
 * - Energy glow uniform (0-1) affecting emissive intensity
 * - Inner light scattering simulation (fake SSS)
 * - Color temperature shift: cool dormant -> hot active
 *
 * States:
 * - **Dormant**: 15 degree tilt, slow Y-axis spin (0.1 rad/s), subtle bob
 * - **Waking**: Spring transition to active (800ms)
 * - **Active**: Facing camera (0 degree tilt), faster spin (0.3 rad/s)
 * - **Sleeping**: Ease-out transition to dormant (800ms)
 * - **Processing**: Gentle pulse spin
 * - **Exploding**: Particle burst, max energy
 * - **Recovering**: Post-explosion cooldown
 *
 * Spring Physics (Phase 26):
 * - Config: { tension: 150, friction: 20, mass: 1 }
 * - 800ms transition duration
 *
 * Geometry Specs:
 * - Major radius: 1 (ring radius)
 * - Tube radius: 0.35 (thickness - premium look)
 * - Radial segments: 96 (around the tube - smooth curves)
 * - Tubular segments: 64 (around the ring)
 *
 * @see shaders/RingShader.ts for shader implementation
 * @see types.ts for RingState definitions
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see .claude/skills/opta-ring-animation.md
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import type { Mesh, ShaderMaterial } from 'three';
import { type RingState, getVisualProperties } from './types';
import {
  createRingShader,
  updateRingShader,
  setRingEnergy,
  setRingState as setShaderState,
  setRingInnerGlow,
  disposeRingShader,
  type RingShaderState,
} from './shaders';

// Re-export RingState for backward compatibility
export type { RingState } from './types';

// =============================================================================
// GEOMETRY CONSTANTS (Phase 24 - Premium Quality)
// =============================================================================

/** Ring major radius (center to tube center) in world units */
const TORUS_MAJOR_RADIUS = 1;

/** Tube cross-section radius (ring thickness) - 0.35 provides premium proportions */
const TORUS_TUBE_RADIUS = 0.35;

/** Radial segments around the tube cross-section (higher = smoother curves) */
const TORUS_RADIAL_SEGMENTS = 96;

/** Tubular segments around the ring circumference */
const TORUS_TUBULAR_SEGMENTS = 64;

// =============================================================================
// ANIMATION CONSTANTS (Phase 26)
// =============================================================================

/** Dormant state X-axis tilt: approximately 15 degrees in radians */
const DORMANT_TILT_RADIANS = Math.PI * 0.083;

/** Active state X-axis tilt: facing camera directly */
const ACTIVE_TILT_RADIANS = 0;

/** Bob animation Y-position amplitude (world units) */
const BOB_AMPLITUDE_UNITS = 0.02;

/** Bob animation frequency in Hz (cycles per second) */
const BOB_FREQUENCY_HZ = 0.5;

/** Bob fade threshold - reduces bob as energy approaches this value */
const BOB_ENERGY_FADE_THRESHOLD = 2;

/** Position smoothing factor when transitioning from dormant to active */
const POSITION_SMOOTHING_FACTOR = 0.9;

/** Minimum position threshold for snapping to zero */
const POSITION_SNAP_THRESHOLD = 0.001;

// =============================================================================
// SPRING CONFIGURATIONS (Phase 26)
// =============================================================================

/**
 * Spring configuration for wake-up animation.
 * Provides bouncy, energetic feel when ring engages.
 *
 * react-spring mapping:
 * - tension ~= stiffness (150)
 * - friction ~= damping (20)
 */
const WAKE_SPRING_CONFIG = {
  mass: 1,
  tension: 150,
  friction: 20,
} as const;

/**
 * Spring configuration for sleep transition.
 * Higher friction provides smooth deceleration without bounce.
 */
const SLEEP_SPRING_CONFIG = {
  mass: 1,
  tension: 120,
  friction: 26, // Higher friction = less oscillation
} as const;

/**
 * Instant transition config for reduced motion accessibility.
 * Skips animation entirely.
 */
const INSTANT_SPRING_CONFIG = {
  duration: 0,
} as const;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the RingMesh Three.js component.
 */
export interface RingMeshProps {
  /**
   * Current state of the ring from the 7-state machine.
   * Controls rotation, spin speed, and shader parameters.
   */
  state: RingState;

  /**
   * Energy level (0-1) controlling glow intensity and fresnel power.
   * @default 0.5
   */
  energyLevel?: number;

  /**
   * Inner glow intensity (0-1) for subsurface scattering simulation.
   * Higher values create more internal light scattering effect.
   */
  innerGlow?: number;

  /**
   * Enable spring physics for tilt transitions.
   * Set to false for reduced-motion accessibility support.
   * @default true
   */
  springEnabled?: boolean;

  /**
   * Use glassmorphism shader material (Phase 25).
   * When false, falls back to standard MeshStandardMaterial.
   * @default true
   */
  useShader?: boolean;
}

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

/**
 * Animated mesh component using react-spring for smooth transitions.
 */
const AnimatedMesh = animated.mesh;

// =============================================================================
// COMPONENT
// =============================================================================

export function RingMesh({
  state,
  energyLevel = 0.5,
  innerGlow,
  springEnabled = true,
  useShader = true,
}: RingMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);

  // Track accumulated time for bob animation
  const timeRef = useRef(0);

  // Memoize torus geometry for performance - created once, reused across renders
  const geometry = useMemo(() => {
    return new THREE.TorusGeometry(
      TORUS_MAJOR_RADIUS,
      TORUS_TUBE_RADIUS,
      TORUS_RADIAL_SEGMENTS,
      TORUS_TUBULAR_SEGMENTS
    );
  }, []);

  // Create glassmorphism shader material if enabled (Phase 25)
  const shaderMaterial = useMemo(() => {
    if (!useShader) return null;

    const material = createRingShader({
      energyLevel,
      innerGlow: innerGlow ?? (state === 'active' ? 0.5 : 0.2),
      state: state as RingShaderState,
    });
    shaderMaterialRef.current = material;
    return material;
  }, [useShader]); // Only recreate if useShader changes

  // Determine if ring is in an engaged state (facing camera directly)
  const isEngagedState = useMemo(() => {
    const ENGAGED_STATES: RingState[] = ['active', 'waking', 'processing', 'exploding', 'recovering'];
    return ENGAGED_STATES.includes(state);
  }, [state]);

  // Target X rotation: engaged states face camera, others are tilted
  const targetRotationX = isEngagedState ? ACTIVE_TILT_RADIANS : DORMANT_TILT_RADIANS;

  // Select spring configuration based on transition direction
  const springConfig = useMemo(() => {
    if (!springEnabled) {
      return INSTANT_SPRING_CONFIG;
    }
    // Disengagement transitions use smoother ease-out
    const isDisengaging = state === 'sleeping' || state === 'dormant';
    return isDisengaging ? SLEEP_SPRING_CONFIG : WAKE_SPRING_CONFIG;
  }, [state, springEnabled]);

  // Spring animation for X rotation (tilt) using react-spring
  const { rotationX } = useSpring({
    rotationX: targetRotationX,
    config: springConfig,
  });

  // Get visual properties from centralized type system
  const visualProps = useMemo(
    () => getVisualProperties(state, energyLevel),
    [state, energyLevel]
  );

  // Update shader state when state changes (Phase 25)
  useEffect(() => {
    if (shaderMaterialRef.current && useShader) {
      setShaderState(shaderMaterialRef.current, state as RingShaderState);
    }
  }, [state, useShader]);

  // Update shader energy when energyLevel changes (Phase 25)
  useEffect(() => {
    if (shaderMaterialRef.current && useShader) {
      setRingEnergy(shaderMaterialRef.current, energyLevel);
    }
  }, [energyLevel, useShader]);

  // Update shader inner glow when innerGlow changes (Phase 25)
  useEffect(() => {
    if (shaderMaterialRef.current && useShader && innerGlow !== undefined) {
      setRingInnerGlow(shaderMaterialRef.current, innerGlow);
    }
  }, [innerGlow, useShader]);

  // Cleanup shader on unmount
  useEffect(() => {
    return () => {
      if (shaderMaterialRef.current) {
        disposeRingShader(shaderMaterialRef.current);
        shaderMaterialRef.current = null;
      }
    };
  }, []);

  // Animation frame loop - runs every frame for continuous animations
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Accumulate time for bob animation phase
    timeRef.current += delta;

    // Update shader time uniform for animated effects (Phase 25)
    if (shaderMaterialRef.current && useShader) {
      updateRingShader(shaderMaterialRef.current, delta);
    }

    // Continuous Y-axis spin at state-defined speed
    meshRef.current.rotation.y += delta * visualProps.rotationSpeedY;

    // Bob animation: subtle Y-position oscillation in dormant/sleeping states
    const shouldBob = state === 'dormant' || state === 'sleeping';

    if (shouldBob) {
      // Reduce bob amplitude as energy increases (fades during wake transition)
      const energyFade = Math.max(0, 1 - energyLevel * BOB_ENERGY_FADE_THRESHOLD);
      const bobPhase = timeRef.current * BOB_FREQUENCY_HZ * Math.PI * 2;
      const bobOffset = Math.sin(bobPhase) * BOB_AMPLITUDE_UNITS * energyFade;
      meshRef.current.position.y = bobOffset;
    } else {
      // Smoothly interpolate back to center position when active
      meshRef.current.position.y *= POSITION_SMOOTHING_FACTOR;

      // Snap to zero when close enough to avoid floating-point drift
      if (Math.abs(meshRef.current.position.y) < POSITION_SNAP_THRESHOLD) {
        meshRef.current.position.y = 0;
      }
    }
  });

  // Extract colors for fallback material
  const { baseColor, emissiveColor, emissiveIntensity } = visualProps;

  // Fallback material PBR settings for premium look
  const FALLBACK_METALNESS = 0.85;
  const FALLBACK_ROUGHNESS = 0.15;
  const FALLBACK_ENV_MAP_INTENSITY = 1;

  return (
    <AnimatedMesh
      ref={meshRef}
      rotation-x={rotationX}
      rotation-y={0}
      rotation-z={0}
      geometry={geometry}
    >
      {useShader && shaderMaterial ? (
        // Phase 25: Glassmorphism shader with fresnel rim lighting
        <primitive object={shaderMaterial} attach="material" />
      ) : (
        // Phase 24 Fallback: Premium MeshStandardMaterial
        <meshStandardMaterial
          color={baseColor}
          metalness={FALLBACK_METALNESS}
          roughness={FALLBACK_ROUGHNESS}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          envMapIntensity={FALLBACK_ENV_MAP_INTENSITY}
        />
      )}
    </AnimatedMesh>
  );
}

export default RingMesh;
