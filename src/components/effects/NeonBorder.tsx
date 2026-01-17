/**
 * NeonBorder Component
 *
 * Premium neon border effect using WebGL shader.
 * Features "traveling light" sweep gradient with halation glow.
 *
 * @see DESIGN_SYSTEM.md - The Opta Ring / Neon Effects
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, PlaneGeometry, Mesh } from 'three';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  createNeonBorderShader,
  updateNeonBorderShader,
  disposeNeonBorderShader,
  setNeonBorderColor,
  isWebGLAvailable,
} from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

export interface NeonBorderProps {
  /** Content to render inside the neon border */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Neon color (CSS color string) */
  color?: string;
  /** Glow intensity (0-1) */
  intensity?: number;
  /** Animation speed multiplier */
  animationSpeed?: number;
  /** Corner radius in normalized units (0-0.2) */
  borderRadius?: number;
  /** Border thickness in normalized units (0-0.05) */
  borderWidth?: number;
  /** Show/hide the neon effect */
  active?: boolean;
  /** Use WebGL (falls back to CSS if unavailable) */
  useWebGL?: boolean;
}

// =============================================================================
// WEBGL NEON MESH COMPONENT
// =============================================================================

interface NeonMeshProps {
  color: string;
  intensity: number;
  animationSpeed: number;
  borderRadius: number;
  borderWidth: number;
  active: boolean;
}

function NeonMesh({
  color,
  intensity,
  animationSpeed,
  borderRadius,
  borderWidth,
  active,
}: NeonMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const { size } = useThree();

  // Animate active state
  const activeValue = useMotionValue(active ? 1 : 0);
  const activeSpring = useSpring(activeValue, { stiffness: 200, damping: 30 });

  // Create shader material
  useEffect(() => {
    materialRef.current = createNeonBorderShader({
      color,
      intensity,
      animationSpeed,
      borderRadius,
      borderWidth,
      active,
    });

    // Update resolution
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }

    return () => {
      if (materialRef.current) {
        disposeNeonBorderShader(materialRef.current);
      }
    };
  }, [intensity, animationSpeed, borderRadius, borderWidth]);

  // Update color when changed
  useEffect(() => {
    if (materialRef.current) {
      setNeonBorderColor(materialRef.current, color);
    }
  }, [color]);

  // Update active state
  useEffect(() => {
    activeValue.set(active ? 1 : 0);
  }, [active, activeValue]);

  // Update resolution on resize
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  }, [size]);

  // Animation loop
  useFrame((_, delta) => {
    if (materialRef.current) {
      updateNeonBorderShader(materialRef.current, delta, {
        width: size.width,
        height: size.height,
      });

      // Smoothly animate active state
      const currentActive = activeSpring.get();
      materialRef.current.uniforms.uActive.value = currentActive;
    }
  });

  // Create geometry
  const geometry = useMemo(() => new PlaneGeometry(2, 2), []);

  if (!materialRef.current) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={materialRef.current}>
      {/* Geometry and material are set via refs */}
    </mesh>
  );
}

// =============================================================================
// CSS FALLBACK
// =============================================================================

interface CSSNeonFallbackProps {
  color: string;
  intensity: number;
  borderRadius: number;
  active: boolean;
}

function CSSNeonFallback({ color, intensity, borderRadius, active }: CSSNeonFallbackProps) {
  if (!active) return null;

  const glowSize = Math.round(20 * intensity);
  const borderRadiusPx = Math.round(borderRadius * 100);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        borderRadius: `${borderRadiusPx}px`,
        boxShadow: `
          0 0 ${glowSize}px ${color}60,
          0 0 ${glowSize * 2}px ${color}30,
          inset 0 0 ${glowSize / 2}px ${color}20
        `,
        border: `2px solid ${color}80`,
        animation: 'neonPulse 2s ease-in-out infinite',
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NeonBorder({
  children,
  className,
  color = '#8b5cf6',
  intensity = 0.8,
  animationSpeed = 1,
  borderRadius = 0.08,
  borderWidth = 0.015,
  active = true,
  useWebGL = true,
}: NeonBorderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Disable animation if reduced motion is preferred
  const effectiveSpeed = prefersReducedMotion ? 0 : animationSpeed;

  // Use CSS fallback if WebGL is unavailable or disabled
  const shouldUseWebGL = useWebGL && webGLAvailable;

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Neon effect layer */}
      <AnimatePresence>
        {shouldUseWebGL ? (
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <Canvas
              className="absolute inset-0"
              gl={{
                alpha: true,
                antialias: false,
                powerPreference: 'high-performance',
              }}
              style={{ background: 'transparent' }}
            >
              <NeonMesh
                color={color}
                intensity={intensity}
                animationSpeed={effectiveSpeed}
                borderRadius={borderRadius}
                borderWidth={borderWidth}
                active={active}
              />
            </Canvas>
          </div>
        ) : (
          <CSSNeonFallback
            color={color}
            intensity={intensity}
            borderRadius={borderRadius}
            active={active}
          />
        )}
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default NeonBorder;
