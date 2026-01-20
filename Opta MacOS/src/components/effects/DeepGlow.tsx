/**
 * DeepGlow Component
 *
 * Premium deep glow effect that responds to system metrics.
 * Features multi-layer corona with reactive color changes based on load.
 *
 * Intensity thresholds:
 * - < 0.3: Subtle purple glow (idle)
 * - 0.3-0.6: Brighter cyan glow (active)
 * - 0.6-0.85: Yellow/orange glow (warning)
 * - > 0.85: Pulsing red glow (critical)
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, PlaneGeometry, Mesh } from 'three';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTelemetry } from '@/hooks/useTelemetry';
import {
  createDeepGlowShader,
  updateDeepGlowShader,
  disposeDeepGlowShader,
  setDeepGlowIntensity,
  setDeepGlowColor,
  setDeepGlowActive,
  getIntensityColor,
  intensityColors,
} from '@/lib/shaders/DeepGlowShader';
import { isWebGLAvailable } from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

export interface DeepGlowProps {
  /** Intensity 0-1, auto-calculated from telemetry if not provided */
  intensity?: number;
  /** Color: 'primary' | 'success' | 'warning' | 'danger', auto from intensity if not provided */
  color?: 'primary' | 'success' | 'warning' | 'danger' | string;
  /** Content to render inside the glow */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Disable the effect */
  disabled?: boolean;
  /** Animation speed multiplier */
  pulseSpeed?: number;
}

// Semantic color mapping
const semanticColors: Record<string, string> = {
  primary: intensityColors.idle,
  success: '#10b981',
  warning: intensityColors.warning,
  danger: intensityColors.critical,
};

// =============================================================================
// WEBGL GLOW MESH COMPONENT
// =============================================================================

interface GlowMeshProps {
  intensity: number;
  color: string;
  pulseSpeed: number;
  active: boolean;
}

function GlowMesh({ intensity, color, pulseSpeed, active }: GlowMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const { size } = useThree();

  // Animate active state smoothly
  const activeValue = useMotionValue(active ? 1 : 0);
  const activeSpring = useSpring(activeValue, { stiffness: 200, damping: 30 });

  // Animate intensity smoothly
  const intensityValue = useMotionValue(intensity);
  const intensitySpring = useSpring(intensityValue, { stiffness: 100, damping: 20 });

  // Create shader material
  useEffect(() => {
    materialRef.current = createDeepGlowShader({
      intensity,
      color,
      pulseSpeed,
      active,
    });

    // Update resolution
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }

    return () => {
      if (materialRef.current) {
        disposeDeepGlowShader(materialRef.current);
      }
    };
  }, [pulseSpeed]);

  // Update color when changed
  useEffect(() => {
    if (materialRef.current) {
      setDeepGlowColor(materialRef.current, color);
    }
  }, [color]);

  // Update intensity when changed
  useEffect(() => {
    intensityValue.set(intensity);
  }, [intensity, intensityValue]);

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
      // Update time
      updateDeepGlowShader(materialRef.current, delta, {
        width: size.width,
        height: size.height,
      });

      // Smooth intensity animation
      const currentIntensity = intensitySpring.get();
      setDeepGlowIntensity(materialRef.current, currentIntensity, false);

      // Smooth active state
      const currentActive = activeSpring.get();
      setDeepGlowActive(materialRef.current, currentActive > 0.5);
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

interface CSSGlowFallbackProps {
  intensity: number;
  color: string;
  active: boolean;
}

function CSSGlowFallback({ intensity, color, active }: CSSGlowFallbackProps) {
  if (!active) return null;

  const glowSize = Math.round(20 + intensity * 40);
  const opacity = 0.3 + intensity * 0.4;

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-xl"
      style={{
        boxShadow: `
          0 0 ${glowSize}px ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')},
          0 0 ${glowSize * 2}px ${color}${Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0')},
          0 0 ${glowSize * 3}px ${color}${Math.round(opacity * 0.2 * 255).toString(16).padStart(2, '0')}
        `,
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DeepGlow({
  intensity: intensityProp,
  color: colorProp,
  children,
  className,
  disabled = false,
  pulseSpeed = 1,
}: DeepGlowProps) {
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Get telemetry for auto-intensity calculation
  const { telemetry } = useTelemetry(2000);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Calculate intensity from telemetry if not provided
  const calculatedIntensity = useMemo(() => {
    if (intensityProp !== undefined) return intensityProp;
    if (!telemetry) return 0.2; // Default idle state

    // Calculate average system load from CPU and memory
    const cpuLoad = telemetry.cpu?.percent ?? 0;
    const memLoad = telemetry.memory?.percent ?? 0;
    const avgLoad = (cpuLoad + memLoad) / 2;

    // Normalize to 0-1 range
    return Math.min(1, avgLoad / 100);
  }, [intensityProp, telemetry]);

  // Resolve color
  const resolvedColor = useMemo(() => {
    // If color prop is provided, use it
    if (colorProp) {
      // Check if it's a semantic color name
      if (semanticColors[colorProp]) {
        return semanticColors[colorProp];
      }
      // Otherwise use as direct color value
      return colorProp;
    }

    // Auto-calculate color from intensity
    return getIntensityColor(calculatedIntensity);
  }, [colorProp, calculatedIntensity]);

  // Disable animation if reduced motion is preferred
  const effectiveSpeed = prefersReducedMotion ? 0 : pulseSpeed;

  // Use CSS fallback if WebGL is unavailable
  const shouldUseWebGL = webGLAvailable && !disabled;

  const isActive = !disabled && calculatedIntensity > 0.05;

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Deep glow effect layer */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {shouldUseWebGL ? (
              <Canvas
                className="absolute inset-0"
                gl={{
                  alpha: true,
                  antialias: false,
                  powerPreference: 'high-performance',
                }}
                style={{ background: 'transparent' }}
              >
                <GlowMesh
                  intensity={calculatedIntensity}
                  color={resolvedColor}
                  pulseSpeed={effectiveSpeed}
                  active={isActive}
                />
              </Canvas>
            ) : (
              <CSSGlowFallback
                intensity={calculatedIntensity}
                color={resolvedColor}
                active={isActive}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default DeepGlow;
