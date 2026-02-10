/**
 * GlassLayer Component - Phase 33: Glass Depth System
 *
 * A premium glass effect component with three depth levels:
 * - background: z-0, blur 8px, opacity 0.3 (deepest layer)
 * - content: z-10, blur 12px, opacity 0.5 (middle layer)
 * - overlay: z-20, blur 16px, opacity 0.7 (front layer)
 *
 * Features:
 * - Dynamic blur intensity based on depth
 * - Light refraction simulation via parallax on mouse move
 * - Frosted edge effects with gradient borders
 * - Animated reflection highlights
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Effects
 */

import { useRef, useState, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// =============================================================================
// TYPES
// =============================================================================

/** Glass depth levels determining z-index, blur, and opacity */
export type GlassDepth = 'background' | 'content' | 'overlay';

export interface GlassLayerProps {
  /** Content to render inside the glass layer */
  children: React.ReactNode;
  /** Depth level of the glass layer */
  depth?: GlassDepth;
  /** Additional CSS classes */
  className?: string;
  /** Enable parallax refraction effect on mouse move */
  enableRefraction?: boolean;
  /** Enable animated reflection highlight */
  enableReflection?: boolean;
  /** Enable frosted edge effects */
  enableFrostedEdges?: boolean;
  /** Enable blur increase on hover (+2px) */
  enableHoverBlur?: boolean;
  /** Custom blur amount (overrides depth-based blur) */
  customBlur?: number;
  /** Custom opacity (overrides depth-based opacity) */
  customOpacity?: number;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Enable entry animation */
  animate?: boolean;
  /** HTML element type to render */
  as?: 'div' | 'section' | 'article' | 'aside';
  /** Click handler */
  onClick?: () => void;
  /** Aria label for accessibility */
  'aria-label'?: string;
  /** Role attribute */
  role?: string;
}

// =============================================================================
// DEPTH CONFIGURATION
// =============================================================================

interface DepthConfig {
  zIndex: number;
  blur: number;
  opacity: number;
  /** Parallax movement factor (higher = more movement) */
  parallaxFactor: number;
}

const DEPTH_CONFIG: Record<GlassDepth, DepthConfig> = {
  background: {
    zIndex: 0,
    blur: 8,
    opacity: 0.3,
    parallaxFactor: 2, // Moves 2px opposite to mouse
  },
  content: {
    zIndex: 10,
    blur: 12,
    opacity: 0.5,
    parallaxFactor: 1, // Moves 1px opposite to mouse
  },
  overlay: {
    zIndex: 20,
    blur: 16,
    opacity: 0.7,
    parallaxFactor: 0, // Stationary (front layer)
  },
};

// =============================================================================
// FROSTED EDGE COMPONENT
// =============================================================================

interface FrostedEdgeProps {
  borderRadius: number;
  isHovered: boolean;
}

function FrostedEdge({ borderRadius, isHovered }: FrostedEdgeProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ borderRadius }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Gradient border: transparent -> white/10% -> transparent */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius,
          background: `linear-gradient(
            135deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
          )`,
          padding: '1px',
          WebkitMask: `
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0)
          `,
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Inner shadow for depth: inset 0 1px 0 white/5% */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      />

      {/* Outer glow on hover: 0 0 20px purple/20% */}
      <motion.div
        className="absolute inset-0"
        style={{ borderRadius }}
        animate={{
          boxShadow: isHovered
            ? '0 0 20px rgba(139, 92, 246, 0.2)'
            : '0 0 0px rgba(139, 92, 246, 0)',
        }}
        transition={springs.gentle}
      />
    </motion.div>
  );
}

// =============================================================================
// REFLECTION HIGHLIGHT COMPONENT
// =============================================================================

interface ReflectionHighlightProps {
  isActive: boolean;
  borderRadius: number;
  prefersReducedMotion: boolean;
}

function ReflectionHighlight({
  isActive,
  borderRadius,
  prefersReducedMotion,
}: ReflectionHighlightProps) {
  // Animation duration: 8s for full cycle
  const animationDuration = prefersReducedMotion ? 0 : 8;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Diagonal gradient highlight - moving slowly across */}
      <motion.div
        className="absolute -left-full -top-full h-[200%] w-[200%]"
        style={{
          background: `linear-gradient(
            135deg,
            transparent 0%,
            transparent 40%,
            rgba(255, 255, 255, 0.05) 45%,
            rgba(255, 255, 255, 0.08) 50%,
            rgba(255, 255, 255, 0.05) 55%,
            transparent 60%,
            transparent 100%
          )`,
        }}
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: ['0%', '100%'],
                y: ['0%', '100%'],
              }
        }
        transition={{
          duration: animationDuration,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      />
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GlassLayer({
  children,
  depth = 'content',
  className,
  enableRefraction = true,
  enableReflection = true,
  enableFrostedEdges = true,
  enableHoverBlur = true,
  customBlur,
  customOpacity,
  borderRadius = 16,
  animate = true,
  as: Component = 'div',
  onClick,
  'aria-label': ariaLabel,
  role,
}: GlassLayerProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Get depth configuration
  const config = DEPTH_CONFIG[depth];
  const baseBlur = customBlur ?? config.blur;
  const baseOpacity = customOpacity ?? config.opacity;

  // Motion values for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring-based smooth parallax movement
  const springConfig = { stiffness: 150, damping: 20, mass: 0.5 };
  const parallaxX = useSpring(mouseX, springConfig);
  const parallaxY = useSpring(mouseY, springConfig);

  // Transform parallax values based on depth
  const factor = enableRefraction && !prefersReducedMotion ? config.parallaxFactor : 0;
  const translateX = useTransform(parallaxX, (v) => v * factor * -1);
  const translateY = useTransform(parallaxY, (v) => v * factor * -1);

  // Handle mouse move for parallax effect
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || prefersReducedMotion || !enableRefraction) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate normalized offset from center (-1 to 1)
      const offsetX = (e.clientX - centerX) / (rect.width / 2);
      const offsetY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp values
      mouseX.set(Math.max(-1, Math.min(1, offsetX)));
      mouseY.set(Math.max(-1, Math.min(1, offsetY)));
    },
    [mouseX, mouseY, prefersReducedMotion, enableRefraction]
  );

  // Reset parallax on mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Calculate current blur (with hover boost)
  const currentBlur = isHovered && enableHoverBlur ? baseBlur + 2 : baseBlur;

  // Determine if reflection should be active (hover/focus only for performance)
  const reflectionActive = enableReflection && isHovered;

  // Create motion component
  const MotionComponent = motion[Component];

  // Memoize static styles
  const glassStyle = useMemo(
    () => ({
      zIndex: config.zIndex,
      borderRadius,
    }),
    [config.zIndex, borderRadius]
  );

  // Background style with dynamic blur and opacity
  const backgroundStyle = useMemo(
    () => ({
      background: `linear-gradient(
        135deg,
        rgba(12, 12, 18, ${baseOpacity}) 0%,
        rgba(12, 12, 18, ${baseOpacity * 0.6}) 100%
      )`,
      backdropFilter: `blur(${currentBlur}px) saturate(${150 + baseOpacity * 30}%)`,
      WebkitBackdropFilter: `blur(${currentBlur}px) saturate(${150 + baseOpacity * 30}%)`,
      borderRadius,
    }),
    [baseOpacity, currentBlur, borderRadius]
  );

  return (
    <MotionComponent
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        // Base border
        'border border-white/[0.08]',
        // Noise texture via background image
        'bg-no-repeat',
        className
      )}
      style={glassStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      aria-label={ariaLabel}
      role={role}
      initial={animate && !prefersReducedMotion ? { opacity: 0, y: 8 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={animate ? springs.smooth : undefined}
    >
      {/* Glass background layer with parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          ...backgroundStyle,
          x: translateX,
          y: translateY,
          // Noise texture overlay
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Frosted edges */}
      {enableFrostedEdges && (
        <FrostedEdge borderRadius={borderRadius} isHovered={isHovered} />
      )}

      {/* Reflection highlight (animated, on hover/focus only) */}
      {enableReflection && (
        <ReflectionHighlight
          isActive={reflectionActive}
          borderRadius={borderRadius}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </MotionComponent>
  );
}

// =============================================================================
// PRESET VARIANTS
// =============================================================================

/** Background glass layer - deepest, most transparent */
export function GlassBackground({
  children,
  ...props
}: Omit<GlassLayerProps, 'depth'>) {
  return (
    <GlassLayer depth="background" {...props}>
      {children}
    </GlassLayer>
  );
}

/** Content glass layer - middle depth, balanced */
export function GlassContent({
  children,
  ...props
}: Omit<GlassLayerProps, 'depth'>) {
  return (
    <GlassLayer depth="content" {...props}>
      {children}
    </GlassLayer>
  );
}

/** Overlay glass layer - front, most opaque */
export function GlassOverlay({
  children,
  ...props
}: Omit<GlassLayerProps, 'depth'>) {
  return (
    <GlassLayer depth="overlay" {...props}>
      {children}
    </GlassLayer>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default GlassLayer;

/**
 * Z-index constants for glass depth system
 * Use these for consistent layering throughout the app
 */
export const GLASS_Z_LAYERS = {
  BACKGROUND: 0,
  CONTENT: 10,
  OVERLAY: 20,
} as const;

export type GlassZLayer = (typeof GLASS_Z_LAYERS)[keyof typeof GLASS_Z_LAYERS];
