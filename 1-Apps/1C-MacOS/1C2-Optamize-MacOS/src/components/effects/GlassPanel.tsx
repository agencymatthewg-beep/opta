/**
 * GlassPanel Component
 *
 * Premium glass effect panel using WebGL shader.
 * Implements 4-layer optical glass simulation:
 * - Backdrop blur
 * - Noise overlay (anti-banding)
 * - Animated specular highlight
 *
 * @see DESIGN_SYSTEM.md - The Obsidian Glass Material System
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, PlaneGeometry, Mesh } from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  createGlassShader,
  updateGlassShader,
  disposeGlassShader,
  isWebGLAvailable,
} from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

export interface GlassPanelProps {
  /** Content to render inside the glass panel */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Blur amount in pixels (0-20) */
  blurAmount?: number;
  /** Noise grain intensity (0-0.1) */
  noiseIntensity?: number;
  /** Enable specular highlight */
  specularEnabled?: boolean;
  /** Animate specular position with time */
  animateSpecular?: boolean;
  /** Use WebGL for premium effect (falls back to CSS if unavailable) */
  useWebGL?: boolean;
}

// =============================================================================
// WEBGL GLASS MESH COMPONENT
// =============================================================================

interface GlassMeshProps {
  blurAmount: number;
  noiseIntensity: number;
  animateSpecular: boolean;
}

function GlassMesh({ blurAmount, noiseIntensity, animateSpecular }: GlassMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const { size } = useThree();

  // Create shader material
  useEffect(() => {
    materialRef.current = createGlassShader({
      blurAmount,
      noiseIntensity,
      specularEnabled: true,
      animateSpecular,
    });

    // Update resolution
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
      materialRef.current.uniforms.uAspect.value = size.width / size.height;
    }

    return () => {
      if (materialRef.current) {
        disposeGlassShader(materialRef.current);
      }
    };
  }, [blurAmount, noiseIntensity, animateSpecular]);

  // Update resolution on resize
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
      materialRef.current.uniforms.uAspect.value = size.width / size.height;
    }
  }, [size]);

  // Animation loop
  useFrame((_, delta) => {
    if (materialRef.current && animateSpecular) {
      updateGlassShader(materialRef.current, delta, {
        width: size.width,
        height: size.height,
      });
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

interface CSSGlassFallbackProps {
  className?: string;
  blurAmount: number;
}

function CSSGlassFallback({ className, blurAmount }: CSSGlassFallbackProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 rounded-inherit',
        'glass',
        'border border-white/5',
        className
      )}
      style={{
        backdropFilter: `blur(${blurAmount}px)`,
        WebkitBackdropFilter: `blur(${blurAmount}px)`,
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GlassPanel({
  children,
  className,
  blurAmount = 12,
  noiseIntensity = 0.03,
  specularEnabled = true,
  animateSpecular = true,
  useWebGL = true,
}: GlassPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Disable animation if reduced motion is preferred
  const shouldAnimate = animateSpecular && !prefersReducedMotion;

  // Use CSS fallback if WebGL is unavailable or disabled
  const shouldUseWebGL = useWebGL && webGLAvailable && specularEnabled;

  return (
    <motion.div
      className={cn('relative overflow-hidden', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glass effect layer */}
      <AnimatePresence>
        {shouldUseWebGL ? (
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-inherit">
            <Canvas
              className="absolute inset-0"
              gl={{
                alpha: true,
                antialias: false,
                powerPreference: 'high-performance',
              }}
              style={{ background: 'transparent' }}
            >
              <GlassMesh
                blurAmount={blurAmount}
                noiseIntensity={noiseIntensity}
                animateSpecular={shouldAnimate}
              />
            </Canvas>
          </div>
        ) : (
          <CSSGlassFallback blurAmount={blurAmount} />
        )}
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default GlassPanel;
