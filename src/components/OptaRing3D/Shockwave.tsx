import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Shockwave - Expanding Ring Geometry for Explosion Effect
 *
 * Creates a circular shockwave that radiates outward from the ring center.
 * Used alongside ExplosionParticles for the complete explosion visual.
 *
 * ## Visual Behavior
 * - Starts at ring radius (default 1 unit)
 * - Expands to 3x radius (default 3 units)
 * - Opacity fades from 0.8 to 0 with ease-out
 * - Default duration: 600ms
 *
 * ## Performance Optimization
 * Uses mesh.scale transform instead of geometry recreation.
 * This eliminates ~36,000 geometry allocations per 60fps explosion,
 * preventing garbage collection pauses and memory pressure.
 *
 * @see Phase 27-03: Ring Explosion Effect
 * @see ExplosionParticles for the accompanying particle burst
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Shockwave color from design system: electric violet */
const SHOCKWAVE_COLOR = '#9333EA';

/** Ring geometry inner/outer ratio for thin shockwave appearance */
const RING_INNER_RATIO = 0.9;
const RING_OUTER_RATIO = 1.1;

/** Ring geometry segment count (balance quality vs performance) */
const RING_SEGMENTS = 48;

/** Opacity fade exponent for smooth disappearance */
const OPACITY_FADE_EXPONENT = 1.5;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the Shockwave component.
 */
interface ShockwaveProps {
  /** Whether the shockwave effect is currently active */
  active: boolean;

  /**
   * Starting radius matching the ring size.
   * @default 1
   */
  startRadius?: number;

  /**
   * End radius after expansion (typically 3x start).
   * @default 3
   */
  endRadius?: number;

  /**
   * Total duration of the shockwave animation in milliseconds.
   * @default 600
   */
  duration?: number;

  /**
   * Initial opacity at expansion start.
   * @default 0.8
   */
  startOpacity?: number;

  /** Callback fired when shockwave expansion completes */
  onComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Shockwave({
  active,
  startRadius = 1,
  endRadius = 3,
  duration = 600,
  startOpacity = 0.8,
  onComplete,
}: ShockwaveProps): React.ReactNode {
  // Refs for Three.js objects and animation state
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  /**
   * Create ring geometry at unit size (scaled at runtime).
   * Using 48 segments balances visual quality with performance.
   */
  const geometry = useMemo(() => {
    return new THREE.RingGeometry(RING_INNER_RATIO, RING_OUTER_RATIO, RING_SEGMENTS);
  }, []);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Reset when shockwave starts
  useEffect(() => {
    if (active) {
      startTimeRef.current = 0;
      hasCompletedRef.current = false;

      // Reset scale to start size
      if (meshRef.current) {
        const scale = startRadius;
        meshRef.current.scale.set(scale, scale, 1);
      }

      // Reset opacity
      if (materialRef.current) {
        materialRef.current.opacity = startOpacity;
      }
    }
  }, [active, startRadius, startOpacity]);

  // Animation frame - uses scale transform for efficiency
  useFrame((state) => {
    if (!active || !meshRef.current || !materialRef.current) return;

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

    // Quadratic ease-out for smooth expansion deceleration
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);

    // Interpolate radius and apply as uniform scale
    const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, easeOutQuad);
    meshRef.current.scale.set(currentRadius, currentRadius, 1);

    // Fade opacity with custom exponent for visual feel
    const opacityFade = 1 - Math.pow(progress, OPACITY_FADE_EXPONENT);
    materialRef.current.opacity = startOpacity * opacityFade;
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshBasicMaterial
        ref={materialRef}
        color={SHOCKWAVE_COLOR}
        transparent
        opacity={startOpacity}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export default Shockwave;
