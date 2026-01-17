/**
 * WebGLBackground Component
 *
 * Full-screen WebGL background layer for premium visual effects.
 * Provides a canvas for shader-based backgrounds and z-layering support.
 *
 * @see DESIGN_SYSTEM.md - The Living Artifact Concept
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isWebGLAvailable, createFPSCounter } from '@/lib/shaders';

// =============================================================================
// TYPES
// =============================================================================

export interface WebGLBackgroundProps {
  /** Custom shader render function */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Z-index for layering */
  zIndex?: number;
  /** Enable performance monitoring */
  enablePerformanceMonitor?: boolean;
  /** Callback for WebGL context events */
  onContextLost?: () => void;
  onContextRestored?: () => void;
  /** Preferred rendering power */
  powerPreference?: 'high-performance' | 'low-power' | 'default';
  /** Enable antialiasing */
  antialias?: boolean;
}

// =============================================================================
// PERFORMANCE MONITOR
// =============================================================================

interface PerformanceMonitorProps {
  enabled: boolean;
  onFPSUpdate?: (fps: number) => void;
}

function PerformanceMonitor({ enabled, onFPSUpdate }: PerformanceMonitorProps) {
  const fpsCounter = useRef(createFPSCounter());

  useFrame(() => {
    if (enabled) {
      const fps = fpsCounter.current.tick();
      if (onFPSUpdate) {
        onFPSUpdate(fps);
      }
    }
  });

  return null;
}

// =============================================================================
// CONTEXT EVENT HANDLERS
// =============================================================================

interface ContextHandlerProps {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

function ContextHandler({ onContextLost, onContextRestored }: ContextHandlerProps) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleContextLost = (event: WebGLContextEvent) => {
      event.preventDefault();
      console.warn('[WebGLBackground] WebGL context lost');
      if (onContextLost) {
        onContextLost();
      }
    };

    const handleContextRestored = () => {
      console.info('[WebGLBackground] WebGL context restored');
      if (onContextRestored) {
        onContextRestored();
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, onContextLost, onContextRestored]);

  return null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function WebGLBackground({
  children,
  className,
  zIndex = -1,
  enablePerformanceMonitor = false,
  onContextLost,
  onContextRestored,
  powerPreference = 'high-performance',
  antialias = false,
}: WebGLBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const [currentFPS, setCurrentFPS] = useState(60);

  // Check WebGL availability
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // FPS update handler
  const handleFPSUpdate = useCallback((fps: number) => {
    setCurrentFPS(fps);
  }, []);

  // If WebGL is not available, render nothing (let CSS handle background)
  if (!webGLAvailable) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        'fixed inset-0 overflow-hidden pointer-events-none',
        className
      )}
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Canvas
        className="absolute inset-0"
        gl={{
          alpha: true,
          antialias,
          powerPreference,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: true,
        }}
        dpr={Math.min(window.devicePixelRatio, 2)} // Limit DPR for performance
        style={{ background: 'transparent' }}
        // Disable automatic updates for better control
        frameloop={prefersReducedMotion ? 'demand' : 'always'}
      >
        {/* Context event handlers */}
        <ContextHandler
          onContextLost={onContextLost}
          onContextRestored={onContextRestored}
        />

        {/* Performance monitor */}
        <PerformanceMonitor
          enabled={enablePerformanceMonitor}
          onFPSUpdate={handleFPSUpdate}
        />

        {/* Custom shader content */}
        {children}
      </Canvas>

      {/* Performance overlay (dev only) */}
      {enablePerformanceMonitor && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs font-mono rounded">
          {currentFPS} FPS
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Z-LAYER CONSTANTS
// =============================================================================

/**
 * Z-index constants for consistent layering across the app.
 * Use these to maintain proper stacking order.
 */
export const Z_LAYERS = {
  /** Background effects (fog, ambient visuals) */
  BACKGROUND: -10,
  /** Glass panels and cards */
  GLASS_PANEL: -5,
  /** Neon borders and glows */
  NEON_GLOW: -1,
  /** Main content */
  CONTENT: 0,
  /** Overlays and modals */
  OVERLAY: 10,
  /** Tooltips and popovers */
  TOOLTIP: 20,
  /** Loading indicators */
  LOADING: 30,
  /** Toast notifications */
  TOAST: 40,
  /** Maximum (dev tools, etc) */
  MAX: 50,
} as const;

export type ZLayer = keyof typeof Z_LAYERS;

export default WebGLBackground;
