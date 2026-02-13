/**
 * ParticleField - Ambient Floating Particle Environment
 *
 * Creates a subtle dust mote particle effect for the Opta atmosphere.
 * Uses Canvas 2D for performance (lighter than WebGL for simple particles).
 *
 * Features:
 * - 50-100 ambient floating particles
 * - Size: 1-3px
 * - Color: white/purple at 10-20% opacity
 * - Slow drift with slight randomness
 * - Parallax depth illusion via varying speeds
 * - Ring attraction during processing state
 * - Reduced motion fallback (static dots)
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOptaRingOptional } from '@/contexts/OptaRingContext';
import { useParticlesOptional } from '@/contexts/ParticleContext';
// Particle type imported for documentation/typing reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Particle as _ParticleType } from '@/contexts/ParticleContext';

// =============================================================================
// TYPES
// =============================================================================

export interface ParticleFieldProps {
  /** Number of ambient particles (50-100) */
  particleCount?: number;
  /** Base color for particles (CSS color) */
  color?: string;
  /** Secondary color for variety */
  secondaryColor?: string;
  /** Overall opacity multiplier (0-1) */
  opacity?: number;
  /** Base movement speed multiplier */
  speedMultiplier?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to connect to OptaRing for attraction */
  connectToRing?: boolean;
  /** Z-index for positioning */
  zIndex?: number;
}

interface AmbientParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  depth: number; // 0-1 for parallax effect
  angle: number;
  angularVelocity: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PARTICLE_COUNT = 75;
const MIN_PARTICLE_SIZE = 1;
const MAX_PARTICLE_SIZE = 3;
const BASE_SPEED = 0.15;
const DRIFT_VARIATION = 0.05;
const ANGULAR_SPEED = 0.001;

// Design system colors
const DEFAULT_COLOR = 'rgba(255, 255, 255, 0.15)';
const DEFAULT_SECONDARY_COLOR = 'rgba(139, 92, 246, 0.12)'; // Neon purple

// =============================================================================
// STATIC PARTICLES FALLBACK (Reduced Motion)
// =============================================================================

interface StaticDotsProps {
  count: number;
  color: string;
  secondaryColor: string;
  opacity: number;
  className?: string;
}

const StaticDots = memo(function StaticDots({
  count,
  color,
  secondaryColor,
  opacity,
  className,
}: StaticDotsProps) {
  // Generate static dot positions
  const dots = useMemo(() => {
    const result: Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      opacity: number;
      color: string;
    }> = [];

    for (let i = 0; i < count; i++) {
      result.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: MIN_PARTICLE_SIZE + Math.random() * (MAX_PARTICLE_SIZE - MIN_PARTICLE_SIZE),
        opacity: (0.1 + Math.random() * 0.1) * opacity,
        color: Math.random() > 0.3 ? color : secondaryColor,
      });
    }

    return result;
  }, [count, color, secondaryColor, opacity]);

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
      aria-hidden="true"
    >
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            opacity: dot.opacity,
          }}
        />
      ))}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ParticleField = memo(function ParticleField({
  particleCount = DEFAULT_PARTICLE_COUNT,
  color = DEFAULT_COLOR,
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  opacity = 1,
  speedMultiplier = 1,
  className,
  connectToRing = true,
  zIndex = -1,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<AmbientParticle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const prefersReducedMotion = useReducedMotion();
  const ringContext = useOptaRingOptional();
  const particleContext = useParticlesOptional();

  // Clamp particle count for performance
  const actualCount = Math.min(Math.max(particleCount, 50), 100);

  // Initialize particles
  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: AmbientParticle[] = [];

      for (let i = 0; i < actualCount; i++) {
        const depth = 0.3 + Math.random() * 0.7; // Depth for parallax
        const size =
          MIN_PARTICLE_SIZE +
          Math.random() * (MAX_PARTICLE_SIZE - MIN_PARTICLE_SIZE) * depth;
        const baseOpacity = (0.1 + Math.random() * 0.1) * opacity * depth;

        particles.push({
          id: i,
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * BASE_SPEED * speedMultiplier,
          vy: (Math.random() - 0.5) * BASE_SPEED * speedMultiplier,
          size,
          opacity: baseOpacity,
          baseOpacity,
          color: Math.random() > 0.3 ? color : secondaryColor,
          depth,
          angle: Math.random() * Math.PI * 2,
          angularVelocity: (Math.random() - 0.5) * ANGULAR_SPEED,
        });
      }

      particlesRef.current = particles;
    },
    [actualCount, color, secondaryColor, opacity, speedMultiplier]
  );

  // Get ring center position
  const getRingCenter = useCallback((): { x: number; y: number } | null => {
    if (!connectToRing || !ringContext) return null;

    // Check if ring is in processing state
    if (ringContext.state !== 'processing') return null;

    // Get window center (ring is typically centered during processing)
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Ring position from context or default to center
    if (typeof ringContext.position === 'object') {
      return ringContext.position;
    } else if (ringContext.position === 'center') {
      return { x: canvas.width / 2, y: canvas.height / 2 };
    }

    return null;
  }, [connectToRing, ringContext]);

  // Update particles physics
  const updateParticles = useCallback(
    (deltaTime: number, width: number, height: number) => {
      const dt = deltaTime / 16.67; // Normalize to 60fps
      const ringCenter = getRingCenter();
      const isAttracting =
        ringCenter !== null && ringContext?.state === 'processing';

      // Sync attraction state with particle context
      if (particleContext && connectToRing) {
        particleContext.setAttracting(isAttracting);
        if (ringCenter) {
          particleContext.setRingPosition(ringCenter);
        }
      }

      particlesRef.current.forEach((particle) => {
        // Apply attraction if ring is processing
        if (isAttracting && ringCenter) {
          const dx = ringCenter.x - particle.x;
          const dy = ringCenter.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 50) {
            // Subtle attraction force (0.01 per design spec)
            const attraction = 0.01 * particle.depth;
            particle.vx += (dx / dist) * attraction * dt;
            particle.vy += (dy / dist) * attraction * dt;
          }
        }

        // Apply drift variation
        particle.vx += (Math.random() - 0.5) * DRIFT_VARIATION * dt;
        particle.vy += (Math.random() - 0.5) * DRIFT_VARIATION * dt;

        // Dampen velocity slightly
        const dampening = 0.999;
        particle.vx *= dampening;
        particle.vy *= dampening;

        // Update position with parallax (deeper particles move slower)
        particle.x += particle.vx * dt * particle.depth;
        particle.y += particle.vy * dt * particle.depth;

        // Update angle for shimmer effect
        particle.angle += particle.angularVelocity * dt;

        // Wrap around screen edges
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        // Subtle opacity fluctuation
        particle.opacity =
          particle.baseOpacity *
          (0.8 + 0.2 * Math.sin(particle.angle * 2));
      });
    },
    [getRingCenter, ringContext, particleContext, connectToRing]
  );

  // Render particles to canvas
  const renderParticles = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw each particle
      particlesRef.current.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(
          /[\d.]+\)$/,
          `${particle.opacity})`
        );
        ctx.fill();

        // Add subtle glow for larger particles
        if (particle.size > 2) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = particle.color.replace(
            /[\d.]+\)$/,
            `${particle.opacity * 0.3})`
          );
          ctx.fill();
        }
      });
    },
    []
  );

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calculate delta time
      const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16.67;
      lastTimeRef.current = timestamp;

      // Cap delta time to prevent huge jumps
      const cappedDelta = Math.min(deltaTime, 50);

      // Update and render
      updateParticles(cappedDelta, canvas.width, canvas.height);
      renderParticles(ctx, canvas.width, canvas.height);

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [updateParticles, renderParticles]
  );

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get device pixel ratio for crisp rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Set canvas size to match window
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Scale canvas back down via CSS
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    // Scale context for DPR
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Reinitialize particles for new dimensions
    initParticles(window.innerWidth, window.innerHeight);
  }, [initParticles]);

  // Setup and cleanup
  useEffect(() => {
    if (prefersReducedMotion) return;

    // Initial setup
    handleResize();

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Listen for resize
    window.addEventListener('resize', handleResize);

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReducedMotion, handleResize, animate]);

  // Reduced motion: show static dots
  if (prefersReducedMotion) {
    return (
      <StaticDots
        count={actualCount}
        color={color}
        secondaryColor={secondaryColor}
        opacity={opacity}
        className={className}
      />
    );
  }

  return (
    <motion.canvas
      ref={canvasRef}
      className={cn(
        'fixed inset-0 pointer-events-none',
        className
      )}
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      aria-hidden="true"
    />
  );
});

export default ParticleField;
