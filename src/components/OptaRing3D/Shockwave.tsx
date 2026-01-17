import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Shockwave - Expanding ring geometry for explosion effect
 *
 * Creates a ring that:
 * - Starts at ring radius (1 unit)
 * - Expands to 3x radius (3 units)
 * - Fades opacity from 0.8 to 0
 * - Completes in 600ms
 *
 * @see Phase 27-03: Ring Explosion Effect
 */

// Design system colors
const SHOCKWAVE_COLOR = '#9333EA'; // Electric violet

interface ShockwaveProps {
  /** Whether the shockwave is active */
  active: boolean;
  /** Starting radius (matches ring size) */
  startRadius?: number;
  /** End radius (3x expansion) */
  endRadius?: number;
  /** Duration in ms */
  duration?: number;
  /** Initial opacity */
  startOpacity?: number;
  /** Callback when shockwave completes */
  onComplete?: () => void;
}

export function Shockwave({
  active,
  startRadius = 1,
  endRadius = 3,
  duration = 600,
  startOpacity = 0.8,
  onComplete,
}: ShockwaveProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  // Reset when shockwave starts
  useEffect(() => {
    if (active) {
      startTimeRef.current = 0;
      hasCompletedRef.current = false;

      // Reset geometry to start size
      if (meshRef.current) {
        const newGeometry = new THREE.RingGeometry(startRadius - 0.1, startRadius + 0.1, 64);
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = newGeometry;
      }

      // Reset opacity
      if (materialRef.current) {
        materialRef.current.opacity = startOpacity;
      }
    }
  }, [active, startRadius, startOpacity]);

  // Animation frame
  useFrame((state) => {
    if (!active || !meshRef.current || !materialRef.current) return;

    // Track elapsed time
    if (startTimeRef.current === 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = (state.clock.elapsedTime - startTimeRef.current) * 1000;
    const progress = Math.min(elapsed / duration, 1);

    // Check if complete
    if (progress >= 1 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
      return;
    }

    // Ease out for smooth expansion
    const easeOut = 1 - Math.pow(1 - progress, 2);

    // Calculate current radius
    const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, easeOut);
    const ringThickness = THREE.MathUtils.lerp(0.2, 0.05, easeOut); // Thins as it expands

    // Update geometry with new radius
    const innerRadius = currentRadius - ringThickness / 2;
    const outerRadius = currentRadius + ringThickness / 2;

    // Dispose old geometry and create new one
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

    // Fade opacity
    materialRef.current.opacity = startOpacity * (1 - Math.pow(progress, 1.5));
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[startRadius - 0.1, startRadius + 0.1, 64]} />
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
