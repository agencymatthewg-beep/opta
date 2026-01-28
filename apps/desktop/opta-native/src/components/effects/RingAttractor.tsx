/**
 * RingAttractor - Particle Attraction to Ring During Processing
 *
 * Creates an energy flow visual where particles slowly drift toward
 * the OptaRing when it's in processing state.
 *
 * Features:
 * - Particles drift toward ring position (0.01 attraction strength)
 * - Particles absorbed at ring edge
 * - Creates visual energy flow
 * - Ring energy increases per absorbed particle
 * - Reduced motion: disabled
 *
 * This component enhances the ParticleField by providing explicit
 * ring attraction controls and visual feedback.
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useRef, useEffect, useCallback, memo, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOptaRingOptional } from '@/contexts/OptaRingContext';

// =============================================================================
// TYPES
// =============================================================================

export interface RingAttractorProps {
  /** Whether attraction is active (overrides ring state check) */
  active?: boolean;
  /** Ring center X position (auto-detected if not provided) */
  ringX?: number;
  /** Ring center Y position (auto-detected if not provided) */
  ringY?: number;
  /** Ring radius for absorption threshold */
  ringRadius?: number;
  /** Attraction strength (0.001 - 0.1, default 0.01) */
  attractionStrength?: number;
  /** Number of ambient particles to generate */
  particleCount?: number;
  /** Callback when particle is absorbed */
  onAbsorb?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Z-index for layer positioning */
  zIndex?: number;
}

interface AttractedParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  absorbed: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PARTICLE_COUNT = 40;
const DEFAULT_ATTRACTION_STRENGTH = 0.01;
const DEFAULT_RING_RADIUS = 60;
const ABSORPTION_RADIUS = 30;
const PARTICLE_COLORS = [
  'rgba(139, 92, 246, 0.4)', // Purple
  'rgba(168, 85, 247, 0.3)', // Lighter purple
  'rgba(255, 255, 255, 0.2)', // White
];
const SPAWN_MARGIN = 100;
const MIN_SPAWN_DISTANCE = 150;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createParticle(
  id: number,
  canvasWidth: number,
  canvasHeight: number,
  ringX: number,
  ringY: number
): AttractedParticle {
  // Spawn particles away from the ring
  let x: number;
  let y: number;
  let attempts = 0;

  do {
    x = Math.random() * (canvasWidth + SPAWN_MARGIN * 2) - SPAWN_MARGIN;
    y = Math.random() * (canvasHeight + SPAWN_MARGIN * 2) - SPAWN_MARGIN;
    attempts++;
  } while (
    Math.sqrt((x - ringX) ** 2 + (y - ringY) ** 2) < MIN_SPAWN_DISTANCE &&
    attempts < 10
  );

  const size = 1.5 + Math.random() * 2;
  const baseOpacity = 0.2 + Math.random() * 0.3;

  return {
    id,
    x,
    y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size,
    opacity: baseOpacity,
    baseOpacity,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    absorbed: false,
  };
}

// =============================================================================
// RING ATTRACTOR COMPONENT
// =============================================================================

export const RingAttractor = memo(function RingAttractor({
  active: activeProp,
  ringX: ringXProp,
  ringY: ringYProp,
  ringRadius = DEFAULT_RING_RADIUS,
  attractionStrength = DEFAULT_ATTRACTION_STRENGTH,
  particleCount = DEFAULT_PARTICLE_COUNT,
  onAbsorb,
  className,
  zIndex = -1,
}: RingAttractorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<AttractedParticle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const particleIdRef = useRef(0);
  const absorbedCountRef = useRef(0);

  const prefersReducedMotion = useReducedMotion();
  const ringContext = useOptaRingOptional();

  // Determine if attraction is active
  const isActive = useMemo(() => {
    if (activeProp !== undefined) return activeProp;
    return ringContext?.state === 'processing';
  }, [activeProp, ringContext?.state]);

  // Get ring position
  const getRingPosition = useCallback((): { x: number; y: number } | null => {
    if (ringXProp !== undefined && ringYProp !== undefined) {
      return { x: ringXProp, y: ringYProp };
    }

    if (!ringContext) return null;

    // Get window dimensions for center calculation
    const canvas = canvasRef.current;
    if (!canvas) return null;

    if (typeof ringContext.position === 'object') {
      return ringContext.position;
    } else if (ringContext.position === 'center') {
      return { x: canvas.width / 2, y: canvas.height / 2 };
    }

    // Default to center
    return { x: canvas.width / 2, y: canvas.height / 2 };
  }, [ringXProp, ringYProp, ringContext]);

  // Initialize particles
  const initParticles = useCallback(
    (width: number, height: number) => {
      const ringPos = getRingPosition() || { x: width / 2, y: height / 2 };
      const particles: AttractedParticle[] = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push(
          createParticle(++particleIdRef.current, width, height, ringPos.x, ringPos.y)
        );
      }

      particlesRef.current = particles;
      absorbedCountRef.current = 0;
    },
    [particleCount, getRingPosition]
  );

  // Update particles physics
  const updateParticles = useCallback(
    (deltaTime: number, width: number, height: number) => {
      const dt = deltaTime / 16.67;
      const ringPos = getRingPosition();

      if (!ringPos || !isActive) {
        // Just gentle drift when not attracting
        particlesRef.current.forEach((particle) => {
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;

          // Wrap around
          if (particle.x < -50) particle.x = width + 50;
          if (particle.x > width + 50) particle.x = -50;
          if (particle.y < -50) particle.y = height + 50;
          if (particle.y > height + 50) particle.y = -50;
        });
        return;
      }

      particlesRef.current.forEach((particle) => {
        if (particle.absorbed) return;

        // Calculate distance to ring
        const dx = ringPos.x - particle.x;
        const dy = ringPos.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check for absorption
        if (dist < ABSORPTION_RADIUS) {
          particle.absorbed = true;
          absorbedCountRef.current++;
          onAbsorb?.();
          return;
        }

        // Apply attraction force (inverse distance for natural feel)
        const normalizedDist = Math.max(dist, 50);
        const force = attractionStrength * (1 + 100 / normalizedDist);

        particle.vx += (dx / dist) * force * dt;
        particle.vy += (dy / dist) * force * dt;

        // Apply slight damping
        particle.vx *= 0.995;
        particle.vy *= 0.995;

        // Update position
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        // Increase opacity as particle approaches ring
        const proximityFactor = 1 - Math.min(dist / 300, 1);
        particle.opacity = particle.baseOpacity * (1 + proximityFactor * 0.5);
      });

      // Replace absorbed particles
      const absorbedParticles = particlesRef.current.filter((p) => p.absorbed);
      if (absorbedParticles.length > 0) {
        absorbedParticles.forEach((p) => {
          const index = particlesRef.current.indexOf(p);
          particlesRef.current[index] = createParticle(
            ++particleIdRef.current,
            width,
            height,
            ringPos.x,
            ringPos.y
          );
        });
      }
    },
    [isActive, attractionStrength, getRingPosition, onAbsorb]
  );

  // Render particles
  const renderParticles = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      const ringPos = getRingPosition();

      particlesRef.current.forEach((particle) => {
        if (particle.absorbed) return;

        // Draw particle trail if moving toward ring
        if (isActive && ringPos) {
          const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
          if (speed > 0.5) {
            const trailLength = Math.min(speed * 3, 15);
            const gradient = ctx.createLinearGradient(
              particle.x,
              particle.y,
              particle.x - (particle.vx / speed) * trailLength,
              particle.y - (particle.vy / speed) * trailLength
            );
            gradient.addColorStop(0, particle.color);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(
              particle.x - (particle.vx / speed) * trailLength,
              particle.y - (particle.vy / speed) * trailLength
            );
            ctx.strokeStyle = gradient;
            ctx.lineWidth = particle.size * 0.5;
            ctx.stroke();
          }
        }

        // Draw particle glow
        const glowGradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 4
        );
        glowGradient.addColorStop(0, particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`));
        glowGradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Draw particle core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${particle.opacity * 1.5})`);
        ctx.fill();
      });

      // Draw absorption zone glow when active
      if (isActive && ringPos) {
        const absorbGradient = ctx.createRadialGradient(
          ringPos.x,
          ringPos.y,
          0,
          ringPos.x,
          ringPos.y,
          ringRadius
        );
        absorbGradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
        absorbGradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.05)');
        absorbGradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(ringPos.x, ringPos.y, ringRadius, 0, Math.PI * 2);
        ctx.fillStyle = absorbGradient;
        ctx.fill();
      }
    },
    [isActive, getRingPosition, ringRadius]
  );

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16.67;
      lastTimeRef.current = timestamp;

      const cappedDelta = Math.min(deltaTime, 50);

      updateParticles(cappedDelta, canvas.width, canvas.height);
      renderParticles(ctx, canvas.width, canvas.height);

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [updateParticles, renderParticles]
  );

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    initParticles(window.innerWidth, window.innerHeight);
  }, [initParticles]);

  // Setup and cleanup
  useEffect(() => {
    if (prefersReducedMotion) return;

    handleResize();
    animationFrameRef.current = requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReducedMotion, handleResize, animate]);

  // Don't render for reduced motion
  if (prefersReducedMotion) {
    return null;
  }

  return (
    <motion.canvas
      ref={canvasRef}
      className={cn('fixed inset-0 pointer-events-none', className)}
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.5 }}
      transition={{ duration: 0.5 }}
      aria-hidden="true"
    />
  );
});

// =============================================================================
// HOOK FOR RING ATTRACTION STATE
// =============================================================================

export interface UseRingAttractionReturn {
  /** Whether attraction is currently active */
  isActive: boolean;
  /** Number of particles absorbed this session */
  absorbedCount: number;
  /** Reset absorbed count */
  resetCount: () => void;
}

export function useRingAttraction(): UseRingAttractionReturn {
  const [absorbedCount, setAbsorbedCount] = useState(0);
  const ringContext = useOptaRingOptional();

  const isActive = ringContext?.state === 'processing';

  const resetCount = useCallback(() => {
    setAbsorbedCount(0);
  }, []);

  // Reset when processing stops
  useEffect(() => {
    if (!isActive) {
      setAbsorbedCount(0);
    }
  }, [isActive]);

  return {
    isActive,
    absorbedCount,
    resetCount,
  };
}

export default RingAttractor;
