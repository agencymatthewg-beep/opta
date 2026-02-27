/**
 * EnergySparks - Spark Particle Effect for Active Elements
 *
 * Creates bright spark particles that appear near hovered/active UI elements.
 * Provides energy feedback for interactive components.
 *
 * Features:
 * - 5-10 sparks per trigger
 * - Color: bright purple #9333EA to white
 * - Size: 2-4px
 * - Outward burst then fade
 * - Duration: 300-500ms
 * - Reduced motion: no sparks (graceful degradation)
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useRef, useEffect, useCallback, memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface EnergySparkProps {
  /** Element to wrap and add spark effect to */
  children: React.ReactNode;
  /** Whether sparks are enabled */
  enabled?: boolean;
  /** Number of sparks (5-10) */
  sparkCount?: number;
  /** Primary spark color */
  color?: string;
  /** Secondary spark color (transition target) */
  secondaryColor?: string;
  /** Spread radius in pixels */
  spread?: number;
  /** Trigger sparks on hover */
  onHover?: boolean;
  /** Trigger sparks on click/tap */
  onClick?: boolean;
  /** Trigger sparks on focus */
  onFocus?: boolean;
  /** Manual trigger control */
  trigger?: boolean;
  /** Callback when sparks complete */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface SparkBurstProps {
  /** Center X position */
  x: number;
  /** Center Y position */
  y: number;
  /** Number of sparks */
  count?: number;
  /** Primary color */
  color?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Spread radius */
  spread?: number;
  /** Called when animation completes */
  onComplete?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_SPARK_COUNT = 8;
const DEFAULT_COLOR = '#9333EA'; // Bright purple
const DEFAULT_SECONDARY_COLOR = '#ffffff'; // White
const DEFAULT_SPREAD = 20;
const MIN_SPARK_SIZE = 2;
const MAX_SPARK_SIZE = 4;
const MIN_LIFE = 300;
const MAX_LIFE = 500;
const INITIAL_SPEED_MIN = 2;
const INITIAL_SPEED_MAX = 5;

// =============================================================================
// SPARK BURST COMPONENT (Standalone)
// =============================================================================

export const SparkBurst = memo(function SparkBurst({
  x,
  y,
  count = DEFAULT_SPARK_COUNT,
  color = DEFAULT_COLOR,
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  spread = DEFAULT_SPREAD,
  onComplete,
}: SparkBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  // Initialize sparks
  const initSparks = useCallback(() => {
    const sparks: Spark[] = [];
    const actualCount = Math.min(Math.max(count, 5), 10);

    for (let i = 0; i < actualCount; i++) {
      const angle = (i / actualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = INITIAL_SPEED_MIN + Math.random() * (INITIAL_SPEED_MAX - INITIAL_SPEED_MIN);
      const size = MIN_SPARK_SIZE + Math.random() * (MAX_SPARK_SIZE - MIN_SPARK_SIZE);
      const life = MIN_LIFE + Math.random() * (MAX_LIFE - MIN_LIFE);

      sparks.push({
        id: i,
        x: x + (Math.random() - 0.5) * spread * 0.3,
        y: y + (Math.random() - 0.5) * spread * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        opacity: 0.8 + Math.random() * 0.2,
        color: Math.random() > 0.3 ? color : secondaryColor,
        life: 0,
        maxLife: life,
      });
    }

    sparksRef.current = sparks;
  }, [x, y, count, color, secondaryColor, spread]);

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and render sparks
      let activeSparks = 0;

      sparksRef.current.forEach((spark) => {
        spark.life += 16.67; // Assume 60fps

        if (spark.life < spark.maxLife) {
          activeSparks++;

          // Apply friction and slight gravity
          spark.vx *= 0.94;
          spark.vy *= 0.94;
          spark.vy += 0.08; // Slight gravity

          // Update position
          spark.x += spark.vx;
          spark.y += spark.vy;

          // Calculate fade
          const lifeRatio = spark.life / spark.maxLife;
          const currentOpacity = spark.opacity * (1 - lifeRatio);
          const currentSize = spark.size * (1 - lifeRatio * 0.4);

          // Draw spark glow
          const gradient = ctx.createRadialGradient(
            spark.x,
            spark.y,
            0,
            spark.x,
            spark.y,
            currentSize * 3
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity * 0.8})`);
          gradient.addColorStop(0.3, `${spark.color}${Math.round(currentOpacity * 255).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');

          ctx.beginPath();
          ctx.arc(spark.x, spark.y, currentSize * 3, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw spark core
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, currentSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
          ctx.fill();
        }
      });

      // Continue or complete
      if (activeSparks > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    },
    [onComplete]
  );

  // Setup and start animation
  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = spread * 6;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Initialize and start
    initSparks();
    startTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [prefersReducedMotion, initSparks, animate, spread, onComplete]);

  // Don't render anything for reduced motion
  if (prefersReducedMotion) {
    return null;
  }

  const size = spread * 6;

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
      aria-hidden="true"
    />
  );
});

// =============================================================================
// ENERGY SPARKS WRAPPER COMPONENT
// =============================================================================

export const EnergySparks = memo(function EnergySparks({
  children,
  enabled = true,
  sparkCount = DEFAULT_SPARK_COUNT,
  color = DEFAULT_COLOR,
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  spread = DEFAULT_SPREAD,
  onHover = true,
  onClick = false,
  onFocus = false,
  trigger = false,
  onComplete,
  className,
}: EnergySparkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const sparkIdRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  // Trigger spark burst at position relative to container
  const triggerSparks = useCallback(
    (event?: React.MouseEvent | React.FocusEvent) => {
      if (!enabled || prefersReducedMotion) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let x: number;
      let y: number;

      if (event && 'clientX' in event) {
        // Mouse event - use cursor position
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
      } else {
        // Focus event or manual trigger - use center
        x = rect.width / 2;
        y = rect.height / 2;
      }

      const id = ++sparkIdRef.current;
      setSparks((prev) => [...prev, { id, x, y }]);
    },
    [enabled, prefersReducedMotion]
  );

  // Remove completed spark
  const removeSpark = useCallback((id: number) => {
    setSparks((prev) => prev.filter((s) => s.id !== id));
    onComplete?.();
  }, [onComplete]);

  // Handle manual trigger
  useEffect(() => {
    if (trigger) {
      triggerSparks();
    }
  }, [trigger, triggerSparks]);

  // Event handlers
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (onHover) {
        triggerSparks(e);
      }
    },
    [onHover, triggerSparks]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onClick) {
        triggerSparks(e);
      }
    },
    [onClick, triggerSparks]
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent) => {
      if (onFocus) {
        triggerSparks(e);
      }
    },
    [onFocus, triggerSparks]
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onFocus={handleFocus}
    >
      {children}

      {/* Spark bursts */}
      <AnimatePresence>
        {sparks.map((spark) => (
          <motion.div
            key={spark.id}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            <SparkBurst
              x={spark.x}
              y={spark.y}
              count={sparkCount}
              color={color}
              secondaryColor={secondaryColor}
              spread={spread}
              onComplete={() => removeSpark(spark.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// =============================================================================
// HOOK FOR PROGRAMMATIC SPARKS
// =============================================================================

export interface UseEnergySparkOptions {
  color?: string;
  secondaryColor?: string;
  count?: number;
  spread?: number;
}

export function useEnergySparks(options: UseEnergySparkOptions = {}) {
  const {
    color = DEFAULT_COLOR,
    secondaryColor = DEFAULT_SECONDARY_COLOR,
    count = DEFAULT_SPARK_COUNT,
    spread = DEFAULT_SPREAD,
  } = options;

  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const idRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  const trigger = useCallback(
    (x: number, y: number) => {
      if (prefersReducedMotion) return;

      const id = ++idRef.current;
      setSparks((prev) => [...prev, { id, x, y }]);

      // Auto cleanup after animation
      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => s.id !== id));
      }, MAX_LIFE + 100);
    },
    [prefersReducedMotion]
  );

  const SparkContainer = useCallback(
    () => (
      <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
        <AnimatePresence>
          {sparks.map((spark) => (
            <SparkBurst
              key={spark.id}
              x={spark.x}
              y={spark.y}
              count={count}
              color={color}
              secondaryColor={secondaryColor}
              spread={spread}
            />
          ))}
        </AnimatePresence>
      </div>
    ),
    [sparks, count, color, secondaryColor, spread]
  );

  return { trigger, SparkContainer };
}

export default EnergySparks;
