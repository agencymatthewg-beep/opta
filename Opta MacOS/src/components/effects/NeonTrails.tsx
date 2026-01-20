/**
 * NeonTrails Component
 *
 * Canvas 2D-based neon glow trail system for premium visual effects.
 * Trails originate from UI elements (cards) and flow toward the Opta ring,
 * triggered by telemetry events (CPU spikes, memory pressure, GPU load).
 *
 * Architecture:
 * - Canvas 2D for performance with many trails
 * - requestAnimationFrame loop for smooth animation
 * - Trail data structure: array of points with timestamps
 * - Quadratic bezier curves for natural flow
 * - Multi-pass rendering for glow effect
 *
 * Performance:
 * - Target <5% CPU usage
 * - Cleanup on unmount (cancelAnimationFrame)
 * - Respects prefers-reduced-motion
 *
 * @see DESIGN_SYSTEM.md - Neon Accent Guidelines
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

/** Single point in a trail */
export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  opacity: number;
}

/** A complete trail */
export interface Trail {
  id: string;
  points: TrailPoint[];
  color: string;
  coreColor: string;
  /** Start position (from card edge) */
  startX: number;
  startY: number;
  /** End position (ring center) */
  endX: number;
  endY: number;
  /** Control point for bezier curve */
  controlX: number;
  controlY: number;
  /** Progress along the trail (0-1) */
  progress: number;
  /** Speed multiplier */
  speed: number;
  /** Trail type */
  type: 'burst' | 'ambient' | 'continuous';
  /** Creation time */
  createdAt: number;
  /** Lifecycle duration in ms */
  lifetime: number;
  /** Whether trail is fading out */
  fading: boolean;
}

/** Trail trigger event from telemetry */
export interface TrailTrigger {
  type: 'cpu_spike' | 'memory_pressure' | 'gpu_load' | 'ambient';
  sourceElement?: string; // data-trail-source attribute value
  intensity: number; // 0-1
}

/** Connection point on a UI element */
export interface ConnectionPoint {
  id: string;
  x: number;
  y: number;
  edge: 'top' | 'right' | 'bottom' | 'left';
}

export interface NeonTrailsProps {
  /** Ring position (center) for trail destination */
  ringPosition?: { x: number; y: number };
  /** Enable ambient idle trails */
  enableAmbient?: boolean;
  /** Ambient trail count (default: 2-3) */
  ambientCount?: number;
  /** Primary trail color (default: #9333EA) */
  primaryColor?: string;
  /** Additional CSS classes */
  className?: string;
  /** Z-index for canvas (default: -5) */
  zIndex?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PRIMARY_COLOR = '#9333EA'; // Design system purple
const DEFAULT_CORE_COLOR = '#ffffff';
const TRAIL_MAX_POINTS = 50;
const AMBIENT_LIFETIME = 8000; // 5-10s for ambient trails
const BURST_LIFETIME = 2000; // Faster for triggered trails
const FADE_DURATION = 500;
const GLOW_LAYERS = 3; // Draw 3x for glow effect
const AMBIENT_OPACITY = 0.15; // Very low for ambient trails

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique trail ID
 */
function generateTrailId(): string {
  return `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get a random edge position on the viewport
 */
function getRandomEdgePosition(viewportWidth: number, viewportHeight: number): { x: number; y: number; edge: 'top' | 'right' | 'bottom' | 'left' } {
  const edge = ['top', 'right', 'bottom', 'left'][Math.floor(Math.random() * 4)] as 'top' | 'right' | 'bottom' | 'left';

  switch (edge) {
    case 'top':
      return { x: Math.random() * viewportWidth, y: 0, edge };
    case 'right':
      return { x: viewportWidth, y: Math.random() * viewportHeight, edge };
    case 'bottom':
      return { x: Math.random() * viewportWidth, y: viewportHeight, edge };
    case 'left':
      return { x: 0, y: Math.random() * viewportHeight, edge };
  }
}

/**
 * Calculate quadratic bezier control point for natural curve
 */
function calculateControlPoint(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number } {
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Offset perpendicular to the line for curve
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular vector
  const perpX = -dy / len;
  const perpY = dx / len;

  // Random offset for variation
  const offset = (Math.random() - 0.5) * len * 0.5;

  return {
    x: midX + perpX * offset,
    y: midY + perpY * offset,
  };
}

/**
 * Get point on quadratic bezier curve at t (0-1)
 */
function getBezierPoint(
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * startX + 2 * u * t * controlX + t * t * endX,
    y: u * u * startY + 2 * u * t * controlY + t * t * endY,
  };
}

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 147, g: 51, b: 234 }; // Fallback to purple
}

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

/**
 * Hook to find connection points from data-trail-source elements
 */
export function useConnectionPoints(): ConnectionPoint[] {
  const [points, setPoints] = useState<ConnectionPoint[]>([]);

  useEffect(() => {
    const updatePoints = () => {
      const elements = document.querySelectorAll('[data-trail-source]');
      const newPoints: ConnectionPoint[] = [];

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const id = el.getAttribute('data-trail-source') || '';

        // Get center of each edge
        newPoints.push(
          { id: `${id}-top`, x: rect.left + rect.width / 2, y: rect.top, edge: 'top' },
          { id: `${id}-right`, x: rect.right, y: rect.top + rect.height / 2, edge: 'right' },
          { id: `${id}-bottom`, x: rect.left + rect.width / 2, y: rect.bottom, edge: 'bottom' },
          { id: `${id}-left`, x: rect.left, y: rect.top + rect.height / 2, edge: 'left' }
        );
      });

      setPoints(newPoints);
    };

    updatePoints();

    // Update on resize and scroll
    window.addEventListener('resize', updatePoints);
    window.addEventListener('scroll', updatePoints);

    // Use MutationObserver to detect DOM changes
    const observer = new MutationObserver(updatePoints);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', updatePoints);
      window.removeEventListener('scroll', updatePoints);
      observer.disconnect();
    };
  }, []);

  return points;
}

/**
 * Hook to trigger trails based on telemetry data
 */
export function useTrailTriggers(
  telemetry: { cpu?: number | null; memory?: number | null; gpu?: number | null } | null,
  onTrigger: (trigger: TrailTrigger) => void
) {
  const prevCpu = useRef<number | null>(null);
  const prevMemory = useRef<number | null>(null);
  const lastTrigger = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!telemetry) return;

    const now = Date.now();
    const COOLDOWN = 1000; // Minimum time between same trigger type

    // CPU spike detection (>80%)
    const cpu = telemetry.cpu;
    if (cpu !== null && cpu !== undefined && cpu > 80) {
      if (prevCpu.current !== null && prevCpu.current <= 80) {
        // CPU just spiked
        if (!lastTrigger.current.cpu || now - lastTrigger.current.cpu > COOLDOWN) {
          lastTrigger.current.cpu = now;
          onTrigger({
            type: 'cpu_spike',
            sourceElement: 'cpu',
            intensity: Math.min((cpu - 80) / 20, 1), // 80-100% maps to 0-1
          });
        }
      }
    }
    prevCpu.current = cpu ?? null;

    // Memory pressure detection (>85%)
    const memory = telemetry.memory;
    if (memory !== null && memory !== undefined && memory > 85) {
      if (prevMemory.current !== null && prevMemory.current <= 85) {
        if (!lastTrigger.current.memory || now - lastTrigger.current.memory > COOLDOWN) {
          lastTrigger.current.memory = now;
          onTrigger({
            type: 'memory_pressure',
            sourceElement: 'memory',
            intensity: Math.min((memory - 85) / 15, 1),
          });
        }
      }
    }
    prevMemory.current = memory ?? null;

    // Continuous GPU load (subtle trails)
    const gpu = telemetry.gpu;
    if (gpu !== null && gpu !== undefined && gpu > 50) {
      if (!lastTrigger.current.gpu || now - lastTrigger.current.gpu > 3000) {
        lastTrigger.current.gpu = now;
        onTrigger({
          type: 'gpu_load',
          sourceElement: 'gpu',
          intensity: gpu / 100 * 0.5, // Subtle intensity
        });
      }
    }
  }, [telemetry, onTrigger]);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NeonTrails({
  ringPosition,
  enableAmbient = true,
  ambientCount = 2,
  primaryColor = DEFAULT_PRIMARY_COLOR,
  className,
  zIndex = -5,
}: NeonTrailsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Trail[]>([]);
  const animationRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  // Default ring position to center of viewport
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const effectiveRingPosition = useMemo(() => {
    if (ringPosition) return ringPosition;
    return {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    };
  }, [ringPosition, viewportSize]);

  // Parse primary color
  const colorRgb = useMemo(() => hexToRgb(primaryColor), [primaryColor]);

  // Update viewport size
  useEffect(() => {
    const updateSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  /**
   * Create a new trail
   */
  const createTrail = useCallback((
    startX: number,
    startY: number,
    type: 'burst' | 'ambient' | 'continuous',
    intensity: number = 1
  ): Trail => {
    const endX = effectiveRingPosition.x;
    const endY = effectiveRingPosition.y;
    const control = calculateControlPoint(startX, startY, endX, endY);

    return {
      id: generateTrailId(),
      points: [],
      color: primaryColor,
      coreColor: DEFAULT_CORE_COLOR,
      startX,
      startY,
      endX,
      endY,
      controlX: control.x,
      controlY: control.y,
      progress: 0,
      speed: type === 'ambient' ? 0.0001 : 0.0003 + intensity * 0.0002,
      type,
      createdAt: Date.now(),
      lifetime: type === 'ambient' ? AMBIENT_LIFETIME + Math.random() * 4000 : BURST_LIFETIME,
      fading: false,
    };
  }, [effectiveRingPosition, primaryColor]);

  /**
   * Create ambient trails
   */
  const createAmbientTrails = useCallback(() => {
    if (prefersReducedMotion || !enableAmbient) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;

    // Count current ambient trails
    const ambientTrails = trailsRef.current.filter(t => t.type === 'ambient' && !t.fading);

    // Spawn new ambient trails if needed
    if (ambientTrails.length < ambientCount) {
      const pos = getRandomEdgePosition(viewportSize.width, viewportSize.height);
      trailsRef.current.push(createTrail(pos.x, pos.y, 'ambient', 0.3));
    }
  }, [createTrail, viewportSize, prefersReducedMotion, enableAmbient, ambientCount]);

  /**
   * Main render loop
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and render trails
    const activeTrails: Trail[] = [];

    for (const trail of trailsRef.current) {
      const age = now - trail.createdAt;

      // Check if trail should start fading
      if (age > trail.lifetime - FADE_DURATION && !trail.fading) {
        trail.fading = true;
      }

      // Remove completed trails
      if (age > trail.lifetime) {
        continue;
      }

      // Update progress
      trail.progress = Math.min(trail.progress + trail.speed * 16, 1); // ~16ms per frame

      // Add new point to trail
      if (trail.progress < 1) {
        const point = getBezierPoint(
          trail.startX,
          trail.startY,
          trail.controlX,
          trail.controlY,
          trail.endX,
          trail.endY,
          trail.progress
        );

        trail.points.push({
          x: point.x,
          y: point.y,
          timestamp: now,
          opacity: 1,
        });

        // Trim old points
        if (trail.points.length > TRAIL_MAX_POINTS) {
          trail.points = trail.points.slice(-TRAIL_MAX_POINTS);
        }
      }

      // Calculate fade multiplier
      let fadeMult = 1;
      if (trail.fading) {
        fadeMult = Math.max(0, 1 - (age - (trail.lifetime - FADE_DURATION)) / FADE_DURATION);
      }

      // Base opacity for trail type
      const baseOpacity = trail.type === 'ambient' ? AMBIENT_OPACITY : 0.6;

      // Render trail with glow effect (3 passes)
      if (trail.points.length > 1) {
        for (let layer = GLOW_LAYERS - 1; layer >= 0; layer--) {
          ctx.save();

          // Outer layers are wider and more transparent (glow effect)
          const layerWidth = 2 + layer * 4;
          const layerOpacity = (layer === 0 ? 1 : 0.3 / layer) * fadeMult;
          const blur = layer * 4;

          if (blur > 0) {
            ctx.filter = `blur(${blur}px)`;
          }

          ctx.beginPath();
          ctx.moveTo(trail.points[0].x, trail.points[0].y);

          for (let i = 1; i < trail.points.length; i++) {
            ctx.lineTo(trail.points[i].x, trail.points[i].y);
          }

          // Create gradient along path
          const gradient = ctx.createLinearGradient(
            trail.startX,
            trail.startY,
            trail.endX,
            trail.endY
          );

          // Trail color with fading head - white core, colored outer glow
          const rgb = layer === 0 ? { r: 255, g: 255, b: 255 } : colorRgb;

          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity})`);
          gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity})`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity * 0.5})`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = layerWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          ctx.restore();
        }
      }

      activeTrails.push(trail);
    }

    trailsRef.current = activeTrails;

    // Spawn ambient trails
    createAmbientTrails();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(render);
  }, [colorRgb, createAmbientTrails]);

  /**
   * Initialize canvas and start animation
   */
  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size with device pixel ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewportSize.width * dpr;
    canvas.height = viewportSize.height * dpr;
    canvas.style.width = `${viewportSize.width}px`;
    canvas.style.height = `${viewportSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Start animation loop
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [viewportSize, render, prefersReducedMotion]);

  // Don't render anything for reduced motion
  if (prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          'fixed inset-0 pointer-events-none',
          className
        )}
        style={{ zIndex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// CONNECTED TRAILS WRAPPER (with telemetry integration)
// =============================================================================

export interface ConnectedNeonTrailsProps extends NeonTrailsProps {
  /** Telemetry data for triggering trails */
  telemetry?: {
    cpu?: number | null;
    memory?: number | null;
    gpu?: number | null;
  } | null;
}

/**
 * NeonTrails with telemetry integration for automatic triggering
 */
export function ConnectedNeonTrails({
  telemetry,
  ...props
}: ConnectedNeonTrailsProps) {
  // Create a stable trigger handler
  const [triggerFn, setTriggerFn] = useState<((trigger: TrailTrigger) => void) | null>(null);

  // Use telemetry triggers
  useTrailTriggers(
    telemetry ?? null,
    useCallback((trigger: TrailTrigger) => {
      if (triggerFn) {
        triggerFn(trigger);
      }
    }, [triggerFn])
  );

  return (
    <NeonTrailsWithImperativeHandle
      {...props}
      onHandlerReady={setTriggerFn}
    />
  );
}

/**
 * NeonTrails with imperative handle for external triggering
 */
interface NeonTrailsWithImperativeHandleProps extends NeonTrailsProps {
  onHandlerReady?: (handler: (trigger: TrailTrigger) => void) => void;
}

function NeonTrailsWithImperativeHandle({
  onHandlerReady,
  ringPosition,
  enableAmbient = true,
  ambientCount = 2,
  primaryColor = DEFAULT_PRIMARY_COLOR,
  className,
  zIndex = -5,
}: NeonTrailsWithImperativeHandleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Trail[]>([]);
  const animationRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  // Viewport size
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const effectiveRingPosition = useMemo(() => {
    if (ringPosition) return ringPosition;
    return {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    };
  }, [ringPosition, viewportSize]);

  const colorRgb = useMemo(() => hexToRgb(primaryColor), [primaryColor]);

  useEffect(() => {
    const updateSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const createTrail = useCallback((
    startX: number,
    startY: number,
    type: 'burst' | 'ambient' | 'continuous',
    intensity: number = 1
  ): Trail => {
    const endX = effectiveRingPosition.x;
    const endY = effectiveRingPosition.y;
    const control = calculateControlPoint(startX, startY, endX, endY);

    return {
      id: generateTrailId(),
      points: [],
      color: primaryColor,
      coreColor: DEFAULT_CORE_COLOR,
      startX,
      startY,
      endX,
      endY,
      controlX: control.x,
      controlY: control.y,
      progress: 0,
      speed: type === 'ambient' ? 0.0001 : 0.0003 + intensity * 0.0002,
      type,
      createdAt: Date.now(),
      lifetime: type === 'ambient' ? AMBIENT_LIFETIME + Math.random() * 4000 : BURST_LIFETIME,
      fading: false,
    };
  }, [effectiveRingPosition, primaryColor]);

  const handleTrigger = useCallback((trigger: TrailTrigger) => {
    if (prefersReducedMotion) return;

    let startX = Math.random() * viewportSize.width;
    let startY = Math.random() * viewportSize.height;

    if (trigger.sourceElement) {
      const elements = document.querySelectorAll(`[data-trail-source="${trigger.sourceElement}"]`);
      if (elements.length > 0) {
        const rect = elements[0].getBoundingClientRect();
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
          case 0:
            startX = rect.left + Math.random() * rect.width;
            startY = rect.top;
            break;
          case 1:
            startX = rect.right;
            startY = rect.top + Math.random() * rect.height;
            break;
          case 2:
            startX = rect.left + Math.random() * rect.width;
            startY = rect.bottom;
            break;
          case 3:
            startX = rect.left;
            startY = rect.top + Math.random() * rect.height;
            break;
        }
      }
    }

    const trailCount = 3 + Math.floor(trigger.intensity * 2);
    for (let i = 0; i < trailCount; i++) {
      const offsetX = (Math.random() - 0.5) * 50;
      const offsetY = (Math.random() - 0.5) * 50;
      trailsRef.current.push(createTrail(
        startX + offsetX,
        startY + offsetY,
        'burst',
        trigger.intensity
      ));
    }
  }, [createTrail, viewportSize, prefersReducedMotion]);

  // Expose handler
  useEffect(() => {
    if (onHandlerReady) {
      onHandlerReady(handleTrigger);
    }
  }, [handleTrigger, onHandlerReady]);

  const createAmbientTrails = useCallback(() => {
    if (prefersReducedMotion || !enableAmbient) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;

    const ambientTrails = trailsRef.current.filter(t => t.type === 'ambient' && !t.fading);

    if (ambientTrails.length < ambientCount) {
      const pos = getRandomEdgePosition(viewportSize.width, viewportSize.height);
      trailsRef.current.push(createTrail(pos.x, pos.y, 'ambient', 0.3));
    }
  }, [createTrail, viewportSize, prefersReducedMotion, enableAmbient, ambientCount]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activeTrails: Trail[] = [];

    for (const trail of trailsRef.current) {
      const age = now - trail.createdAt;

      if (age > trail.lifetime - FADE_DURATION && !trail.fading) {
        trail.fading = true;
      }

      if (age > trail.lifetime) {
        continue;
      }

      trail.progress = Math.min(trail.progress + trail.speed * 16, 1);

      if (trail.progress < 1) {
        const point = getBezierPoint(
          trail.startX,
          trail.startY,
          trail.controlX,
          trail.controlY,
          trail.endX,
          trail.endY,
          trail.progress
        );

        trail.points.push({
          x: point.x,
          y: point.y,
          timestamp: now,
          opacity: 1,
        });

        if (trail.points.length > TRAIL_MAX_POINTS) {
          trail.points = trail.points.slice(-TRAIL_MAX_POINTS);
        }
      }

      let fadeMult = 1;
      if (trail.fading) {
        fadeMult = Math.max(0, 1 - (age - (trail.lifetime - FADE_DURATION)) / FADE_DURATION);
      }

      const baseOpacity = trail.type === 'ambient' ? AMBIENT_OPACITY : 0.6;

      if (trail.points.length > 1) {
        for (let layer = GLOW_LAYERS - 1; layer >= 0; layer--) {
          ctx.save();

          const layerWidth = 2 + layer * 4;
          const layerOpacity = (layer === 0 ? 1 : 0.3 / layer) * fadeMult;
          const blur = layer * 4;

          if (blur > 0) {
            ctx.filter = `blur(${blur}px)`;
          }

          ctx.beginPath();
          ctx.moveTo(trail.points[0].x, trail.points[0].y);

          for (let i = 1; i < trail.points.length; i++) {
            ctx.lineTo(trail.points[i].x, trail.points[i].y);
          }

          const gradient = ctx.createLinearGradient(
            trail.startX,
            trail.startY,
            trail.endX,
            trail.endY
          );

          const rgb = layer === 0 ? { r: 255, g: 255, b: 255 } : colorRgb;

          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity})`);
          gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity})`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * layerOpacity * 0.5})`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = layerWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          ctx.restore();
        }
      }

      activeTrails.push(trail);
    }

    trailsRef.current = activeTrails;

    createAmbientTrails();

    animationRef.current = requestAnimationFrame(render);
  }, [colorRgb, createAmbientTrails]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewportSize.width * dpr;
    canvas.height = viewportSize.height * dpr;
    canvas.style.width = `${viewportSize.width}px`;
    canvas.style.height = `${viewportSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [viewportSize, render, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          'fixed inset-0 pointer-events-none',
          className
        )}
        style={{ zIndex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default NeonTrails;
