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

const MAJOR_RADIUS = 1;        // Ring radius
const TUBE_RADIUS = 0.35;      // Tube thickness (0.35 for premium look)
const RADIAL_SEGMENTS = 96;    // Segments around the tube (smooth curves)
const TUBULAR_SEGMENTS = 64;   // Segments around the ring

// =============================================================================
// ANIMATION CONSTANTS (Phase 26)
// =============================================================================

/** Dormant state: 15 degrees tilted (Math.PI * 15/180 = Math.PI * 0.083) */
const DORMANT_TILT = Math.PI * 0.083;

/** Active state: directly facing camera */
const ACTIVE_TILT = 0;

/** Bob animation amplitude (subtle sine wave on Y position) */
const BOB_AMPLITUDE = 0.02;

/** Bob animation frequency (Hz) */
const BOB_FREQUENCY = 0.5;

// =============================================================================
// SPRING CONFIGURATIONS (Phase 26)
// =============================================================================

/**
 * Spring config for ring wake-up animation.
 * Based on spec: { stiffness: 150, damping: 20, mass: 1 }
 *
 * In react-spring:
 * - tension ~= stiffness
 * - friction ~= damping
 */
const WAKE_SPRING_CONFIG = {
  mass: 1,
  tension: 150,
  friction: 20,
};

/**
 * Ease-out config for sleep transition (less bouncy, more sleepy feel)
 */
const SLEEP_SPRING_CONFIG = {
  mass: 1,
  tension: 120,
  friction: 26, // Higher friction = less oscillation
};

/**
 * Instant config for reduced motion
 */
const INSTANT_CONFIG = {
  duration: 0,
};

// =============================================================================
// TYPES
// =============================================================================

export interface RingMeshProps {
  /** Current state of the ring */
  state: RingState;
  /** Energy level 0-1 (controls glow intensity) */
  energyLevel?: number;
  /** Inner glow intensity 0-1 (subsurface scattering) - Phase 25 */
  innerGlow?: number;
  /** Whether spring animations are enabled (for reduced motion support) */
  springEnabled?: boolean;
  /** Use glassmorphism shader (default: true) - Phase 25 */
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

  // Memoize geometry for performance - premium quality settings
  const geometry = useMemo(() => {
    return new THREE.TorusGeometry(
      MAJOR_RADIUS,
      TUBE_RADIUS,
      RADIAL_SEGMENTS,
      TUBULAR_SEGMENTS
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

  // Determine if we're in an engaged state (facing camera)
  const isEngaged = useMemo(() => {
    return state === 'active' ||
      state === 'waking' ||
      state === 'processing' ||
      state === 'exploding' ||
      state === 'recovering';
  }, [state]);

  // Determine target rotation based on engagement
  const targetRotationX = isEngaged ? ACTIVE_TILT : DORMANT_TILT;

  // Choose spring config based on direction of transition
  const springConfig = useMemo(() => {
    if (!springEnabled) return INSTANT_CONFIG;
    if (state === 'sleeping' || state === 'dormant') {
      return SLEEP_SPRING_CONFIG; // Ease-out for sleeping
    }
    return WAKE_SPRING_CONFIG; // Bouncy spring for waking
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

  // Animation loop
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Update time for bob animation
    timeRef.current += delta;

    // Update shader time for animations (Phase 25)
    if (shaderMaterialRef.current && useShader) {
      updateRingShader(shaderMaterialRef.current, delta);
    }

    // Apply Y rotation speed (continuous spin)
    meshRef.current.rotation.y += delta * visualProps.rotationSpeedY;

    // Apply subtle bob animation only in dormant/sleeping states
    if (state === 'dormant' || state === 'sleeping') {
      // Reduce bob amplitude as energy increases (bob fades during wake)
      const bobMultiplier = Math.max(0, 1 - energyLevel * 2);
      const bobOffset =
        Math.sin(timeRef.current * BOB_FREQUENCY * Math.PI * 2) *
        BOB_AMPLITUDE *
        bobMultiplier;
      meshRef.current.position.y = bobOffset;
    } else {
      // Smoothly return to center when active
      meshRef.current.position.y *= 0.9;
      if (Math.abs(meshRef.current.position.y) < 0.001) {
        meshRef.current.position.y = 0;
      }
    }
  });

  // Determine colors based on state (for fallback material)
  const baseColor = visualProps.baseColor;
  const emissiveColor = visualProps.emissiveColor;

  return (
    <AnimatedMesh
      ref={meshRef}
      rotation-x={rotationX}
      rotation-y={0}
      rotation-z={0}
      geometry={geometry}
    >
      {useShader && shaderMaterial ? (
        // Phase 25: Glassmorphism shader material with fresnel rim lighting
        <primitive object={shaderMaterial} attach="material" />
      ) : (
        // Fallback: Premium standard material (Phase 24)
        <meshStandardMaterial
          color={baseColor}
          metalness={0.85}
          roughness={0.15}
          emissive={emissiveColor}
          emissiveIntensity={visualProps.emissiveIntensity}
          envMapIntensity={1}
        />
      )}
    </AnimatedMesh>
  );
}

export default RingMesh;
