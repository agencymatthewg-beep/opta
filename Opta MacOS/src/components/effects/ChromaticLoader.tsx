/**
 * ChromaticLoader Component
 *
 * Loading state wrapper with chromatic aberration effect.
 * Applies pulsing RGB channel separation during loading.
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ShaderMaterial, PlaneGeometry, Mesh } from 'three';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  createChromaticShader,
  updateChromaticShader,
  disposeChromaticShader,
  chromaticPresets,
  isWebGLAvailable,
  type ChromaticPreset,
} from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

export interface ChromaticLoaderProps {
  /** Content to render (receives aberration effect when loading) */
  children: React.ReactNode;
  /** Whether content is currently loading */
  isLoading: boolean;
  /** Effect intensity preset */
  preset?: ChromaticPreset;
  /** Custom intensity (overrides preset) */
  intensity?: number;
  /** Additional CSS classes */
  className?: string;
  /** Use WebGL (falls back to CSS if unavailable) */
  useWebGL?: boolean;
  /** Callback when loading animation completes */
  onAnimationComplete?: () => void;
}

// =============================================================================
// WEBGL CHROMATIC MESH COMPONENT
// =============================================================================

interface ChromaticMeshProps {
  intensity: number;
  isLoading: boolean;
  animated: boolean;
}

function ChromaticMesh({ intensity, isLoading, animated }: ChromaticMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);

  // Animate phase value
  const phaseValue = useMotionValue(isLoading ? 1 : 0);
  const phaseSpring = useSpring(phaseValue, {
    stiffness: 150,
    damping: 20,
  });

  // Create shader material
  useEffect(() => {
    materialRef.current = createChromaticShader({
      intensity,
      animated,
      radialMode: true,
      center: { x: 0.5, y: 0.5 },
    });

    return () => {
      if (materialRef.current) {
        disposeChromaticShader(materialRef.current);
      }
    };
  }, [intensity, animated]);

  // Update loading state
  useEffect(() => {
    phaseValue.set(isLoading ? 1 : 0);
  }, [isLoading, phaseValue]);

  // Animation loop
  useFrame((_, delta) => {
    if (materialRef.current) {
      updateChromaticShader(materialRef.current, delta);

      // Smoothly animate phase
      const currentPhase = phaseSpring.get();
      materialRef.current.uniforms.uAnimationPhase.value = currentPhase;
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

interface CSSChromaticFallbackProps {
  isLoading: boolean;
  intensity: number;
  children: React.ReactNode;
}

function CSSChromaticFallback({ isLoading, intensity, children }: CSSChromaticFallbackProps) {
  const offset = Math.round(intensity * 3);

  return (
    <div className="relative">
      {/* Main content */}
      {children}

      {/* Chromatic overlay effect */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Red channel offset */}
            <motion.div
              className="absolute inset-0 mix-blend-screen opacity-30"
              style={{
                backgroundColor: '#ff0000',
                filter: `blur(${offset}px)`,
              }}
              animate={{
                x: [0, offset, 0, -offset, 0],
                opacity: [0.1, 0.3, 0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            {/* Blue channel offset */}
            <motion.div
              className="absolute inset-0 mix-blend-screen opacity-30"
              style={{
                backgroundColor: '#0000ff',
                filter: `blur(${offset}px)`,
              }}
              animate={{
                x: [0, -offset, 0, offset, 0],
                opacity: [0.1, 0.3, 0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChromaticLoader({
  children,
  isLoading,
  preset = 'loading',
  intensity: customIntensity,
  className,
  useWebGL = true,
  onAnimationComplete,
}: ChromaticLoaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Get preset configuration
  const presetConfig = chromaticPresets[preset];
  const intensity = customIntensity ?? presetConfig.intensity;
  const animated = presetConfig.animated && !prefersReducedMotion;

  // Use CSS fallback if WebGL is unavailable, disabled, or reduced motion
  const shouldUseWebGL = useWebGL && webGLAvailable && !prefersReducedMotion;

  // Handle animation complete callback
  const handleAnimationComplete = useCallback(() => {
    if (!isLoading && onAnimationComplete) {
      onAnimationComplete();
    }
  }, [isLoading, onAnimationComplete]);

  // If reduced motion is preferred, skip the effect entirely
  if (prefersReducedMotion) {
    return (
      <motion.div
        className={cn('relative', className)}
        animate={{ opacity: isLoading ? 0.7 : 1 }}
        transition={{ duration: 0.15 }}
        onAnimationComplete={handleAnimationComplete}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={handleAnimationComplete}
    >
      {shouldUseWebGL ? (
        <>
          {/* Content layer */}
          <div className="relative z-10">{children}</div>

          {/* WebGL chromatic effect overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                className="absolute inset-0 z-20 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Canvas
                  className="absolute inset-0"
                  gl={{
                    alpha: true,
                    antialias: false,
                    powerPreference: 'high-performance',
                  }}
                  style={{ background: 'transparent' }}
                >
                  <ChromaticMesh
                    intensity={intensity}
                    isLoading={isLoading}
                    animated={animated}
                  />
                </Canvas>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <CSSChromaticFallback isLoading={isLoading} intensity={intensity}>
          {children}
        </CSSChromaticFallback>
      )}
    </motion.div>
  );
}

export default ChromaticLoader;
