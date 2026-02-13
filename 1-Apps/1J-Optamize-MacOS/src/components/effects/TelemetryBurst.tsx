/**
 * TelemetryBurst - Data Burst Particles on Telemetry Updates
 *
 * Creates particle bursts when telemetry values change significantly.
 * Connects to useTelemetry hook to monitor CPU, memory, and other metrics.
 *
 * Features:
 * - Burst on significant CPU change (>10%)
 * - Burst on significant memory change (>5%)
 * - Particle count proportional to change magnitude
 * - Radial outward direction
 * - Color matches telemetry card accent
 * - Reduced motion: no bursts
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

export interface TelemetryBurstProps {
  /** Element to wrap (typically a telemetry card) */
  children: React.ReactNode;
  /** Metric type for color selection */
  metricType: 'cpu' | 'memory' | 'network' | 'disk' | 'gpu' | 'temperature';
  /** Current metric value (0-100) */
  value: number;
  /** Previous metric value for comparison */
  previousValue?: number;
  /** Change threshold to trigger burst (default varies by type) */
  threshold?: number;
  /** Whether bursts are enabled */
  enabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface BurstParticle {
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

export interface DataBurstProps {
  /** Center X position (relative to container) */
  x: number;
  /** Center Y position (relative to container) */
  y: number;
  /** Number of particles */
  count: number;
  /** Particle color */
  color: string;
  /** Magnitude of change (affects velocity) */
  magnitude?: number;
  /** Called when animation completes */
  onComplete?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Default thresholds per metric type
const DEFAULT_THRESHOLDS: Record<string, number> = {
  cpu: 10, // 10% change
  memory: 5, // 5% change
  network: 15, // 15% change
  disk: 10, // 10% change
  gpu: 10, // 10% change
  temperature: 5, // 5 degrees change
};

// Colors per metric type (from design system)
const METRIC_COLORS: Record<string, string> = {
  cpu: '#8b5cf6', // Purple (primary)
  memory: '#3b82f6', // Blue
  network: '#06b6d4', // Cyan
  disk: '#f59e0b', // Amber
  gpu: '#22c55e', // Green
  temperature: '#ef4444', // Red
};

const MIN_PARTICLE_COUNT = 5;
const MAX_PARTICLE_COUNT = 25;
const BASE_LIFE = 400;
const LIFE_VARIATION = 300;

// =============================================================================
// DATA BURST COMPONENT (Standalone Canvas Animation)
// =============================================================================

export const DataBurst = memo(function DataBurst({
  x,
  y,
  count,
  color,
  magnitude = 1,
  onComplete,
}: DataBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  // Initialize particles
  const initParticles = useCallback(() => {
    const particles: BurstParticle[] = [];
    const actualCount = Math.min(Math.max(count, MIN_PARTICLE_COUNT), MAX_PARTICLE_COUNT);

    for (let i = 0; i < actualCount; i++) {
      // Radial distribution
      const angle = (i / actualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = (1 + Math.random() * 2) * magnitude;
      const size = 2 + Math.random() * 3;
      const maxLife = BASE_LIFE + Math.random() * LIFE_VARIATION;

      particles.push({
        id: i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        opacity: 0.6 + Math.random() * 0.4,
        color,
        life: 0,
        maxLife,
      });
    }

    particlesRef.current = particles;
  }, [x, y, count, color, magnitude]);

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

      // Update and render particles
      let activeSparks = 0;

      particlesRef.current.forEach((particle) => {
        particle.life += 16.67; // Assume 60fps

        if (particle.life < particle.maxLife) {
          activeSparks++;

          // Apply friction
          particle.vx *= 0.97;
          particle.vy *= 0.97;

          // Update position
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Calculate fade
          const lifeRatio = particle.life / particle.maxLife;
          const currentOpacity = particle.opacity * (1 - lifeRatio);
          const currentSize = particle.size * (1 - lifeRatio * 0.5);

          // Draw glow
          const gradient = ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            currentSize * 4
          );
          gradient.addColorStop(0, `${particle.color}${Math.round(currentOpacity * 200).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(0.5, `${particle.color}${Math.round(currentOpacity * 100).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(1, `${particle.color}00`);

          ctx.beginPath();
          ctx.arc(particle.x, particle.y, currentSize * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw core
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 0.8})`;
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
    const size = 200; // Fixed size for burst area
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Initialize particles at canvas center
    particlesRef.current = [];
    initParticles();

    // Adjust particle positions to canvas center
    particlesRef.current.forEach((p) => {
      p.x = size / 2;
      p.y = size / 2;
    });

    startTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [prefersReducedMotion, initParticles, animate, onComplete]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        left: x - 100,
        top: y - 100,
        width: 200,
        height: 200,
      }}
      aria-hidden="true"
    />
  );
});

// =============================================================================
// TELEMETRY BURST WRAPPER COMPONENT
// =============================================================================

export const TelemetryBurst = memo(function TelemetryBurst({
  children,
  metricType,
  value,
  previousValue,
  threshold,
  enabled = true,
  className,
}: TelemetryBurstProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; count: number; magnitude: number }>>([]);
  const burstIdRef = useRef(0);
  const lastValueRef = useRef<number | null>(previousValue ?? null);
  const prefersReducedMotion = useReducedMotion();

  // Get threshold for this metric type
  const effectiveThreshold = threshold ?? DEFAULT_THRESHOLDS[metricType] ?? 10;

  // Get color for this metric type
  const color = METRIC_COLORS[metricType] ?? METRIC_COLORS.cpu;

  // Check for significant change and trigger burst
  useEffect(() => {
    if (!enabled || prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    // Skip if this is the first value
    if (lastValueRef.current === null) {
      lastValueRef.current = value;
      return;
    }

    // Calculate change
    const change = Math.abs(value - lastValueRef.current);

    // Check if change exceeds threshold
    if (change >= effectiveThreshold) {
      const rect = container.getBoundingClientRect();

      // Calculate particle count based on change magnitude (5-25 particles)
      const magnitude = Math.min(change / effectiveThreshold, 3);
      const particleCount = Math.round(MIN_PARTICLE_COUNT + (MAX_PARTICLE_COUNT - MIN_PARTICLE_COUNT) * (magnitude / 3));

      // Trigger burst at center of container
      const id = ++burstIdRef.current;
      setBursts((prev) => [
        ...prev,
        {
          id,
          x: rect.width / 2,
          y: rect.height / 2,
          count: particleCount,
          magnitude: Math.min(magnitude, 2),
        },
      ]);
    }

    lastValueRef.current = value;
  }, [value, enabled, effectiveThreshold, prefersReducedMotion]);

  // Remove completed burst
  const removeBurst = useCallback((id: number) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {children}

      {/* Burst effects */}
      <AnimatePresence>
        {bursts.map((burst) => (
          <motion.div
            key={burst.id}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            <DataBurst
              x={burst.x}
              y={burst.y}
              count={burst.count}
              color={color}
              magnitude={burst.magnitude}
              onComplete={() => removeBurst(burst.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// =============================================================================
// HOOK FOR TELEMETRY BURST INTEGRATION
// =============================================================================

export interface UseTelemetryBurstOptions {
  /** Metric type for color and threshold defaults */
  metricType: 'cpu' | 'memory' | 'network' | 'disk' | 'gpu' | 'temperature';
  /** Custom threshold override */
  threshold?: number;
  /** Whether bursts are enabled */
  enabled?: boolean;
}

export interface UseTelemetryBurstReturn {
  /** Call with new value to check for burst trigger */
  updateValue: (value: number) => void;
  /** Current bursts to render */
  bursts: Array<{ id: number; count: number; magnitude: number }>;
  /** Color for this metric type */
  color: string;
  /** Render function for bursts at a position */
  renderBursts: (x: number, y: number) => React.ReactNode;
}

export function useTelemetryBurst(options: UseTelemetryBurstOptions): UseTelemetryBurstReturn {
  const { metricType, threshold, enabled = true } = options;

  const [bursts, setBursts] = useState<Array<{ id: number; count: number; magnitude: number }>>([]);
  const lastValueRef = useRef<number | null>(null);
  const burstIdRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  const effectiveThreshold = threshold ?? DEFAULT_THRESHOLDS[metricType] ?? 10;
  const color = METRIC_COLORS[metricType] ?? METRIC_COLORS.cpu;

  const updateValue = useCallback(
    (value: number) => {
      if (!enabled || prefersReducedMotion) return;

      if (lastValueRef.current === null) {
        lastValueRef.current = value;
        return;
      }

      const change = Math.abs(value - lastValueRef.current);

      if (change >= effectiveThreshold) {
        const magnitude = Math.min(change / effectiveThreshold, 3);
        const particleCount = Math.round(
          MIN_PARTICLE_COUNT + (MAX_PARTICLE_COUNT - MIN_PARTICLE_COUNT) * (magnitude / 3)
        );

        const id = ++burstIdRef.current;
        setBursts((prev) => [...prev, { id, count: particleCount, magnitude: Math.min(magnitude, 2) }]);

        // Auto cleanup
        setTimeout(() => {
          setBursts((prev) => prev.filter((b) => b.id !== id));
        }, BASE_LIFE + LIFE_VARIATION + 100);
      }

      lastValueRef.current = value;
    },
    [enabled, effectiveThreshold, prefersReducedMotion]
  );

  const renderBursts = useCallback(
    (x: number, y: number) => (
      <AnimatePresence>
        {bursts.map((burst) => (
          <DataBurst
            key={burst.id}
            x={x}
            y={y}
            count={burst.count}
            color={color}
            magnitude={burst.magnitude}
          />
        ))}
      </AnimatePresence>
    ),
    [bursts, color]
  );

  return {
    updateValue,
    bursts,
    color,
    renderBursts,
  };
}

export default TelemetryBurst;
