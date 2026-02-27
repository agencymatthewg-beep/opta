/**
 * DataStream Component
 *
 * Canvas-based falling matrix-style characters effect.
 * Creates a data stream aesthetic for loading screens.
 *
 * Effect details:
 * - Characters: 0-9, A-F (hex)
 * - Color: purple #9333EA fading to transparent
 * - Speed: varying per column
 * - Density: sparse (not overwhelming)
 * - Use as background for loading screens
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface DataStreamProps {
  /** Whether the effect is active */
  active?: boolean;
  /** Primary color for characters (default #9333EA - purple) */
  color?: string;
  /** Character set to use */
  charset?: 'hex' | 'binary' | 'numeric' | 'alphanumeric';
  /** Character density (0-1, default 0.3 for sparse) */
  density?: number;
  /** Font size in pixels (default 14) */
  fontSize?: number;
  /** Speed multiplier (default 1) */
  speed?: number;
  /** Additional CSS classes */
  className?: string;
  /** Children to render above the stream */
  children?: React.ReactNode;
  /** Opacity of the effect (0-1, default 0.8) */
  opacity?: number;
}

// =============================================================================
// CHARACTER SETS
// =============================================================================

const CHARSETS = {
  hex: '0123456789ABCDEF',
  binary: '01',
  numeric: '0123456789',
  alphanumeric: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
};

// =============================================================================
// COLUMN CLASS
// =============================================================================

interface Column {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  maxLength: number;
  opacity: number;
}

// =============================================================================
// CANVAS RENDERER
// =============================================================================

interface CanvasRendererProps {
  color: string;
  charset: string;
  density: number;
  fontSize: number;
  speed: number;
  opacity: number;
}

function useDataStreamCanvas({
  color,
  charset,
  density,
  fontSize,
  speed,
  opacity,
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<Column[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Parse color to RGB for gradient
  const parseColor = useCallback((hexColor: string) => {
    const hex = hexColor.replace('#', '');
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }, []);

  // Initialize columns
  const initColumns = useCallback((width: number, height: number) => {
    const columns: Column[] = [];
    const columnWidth = fontSize * 1.2;
    const numColumns = Math.ceil(width / columnWidth);
    // maxChars not used but kept for potential future optimizations

    for (let i = 0; i < numColumns; i++) {
      // Only create column if within density threshold
      if (Math.random() > density) continue;

      const maxLength = Math.floor(Math.random() * 8) + 4; // 4-12 chars
      const chars: string[] = [];

      for (let j = 0; j < maxLength; j++) {
        chars.push(charset[Math.floor(Math.random() * charset.length)]);
      }

      columns.push({
        x: i * columnWidth,
        y: Math.random() * -height, // Start above viewport
        speed: (0.5 + Math.random() * 1.5) * speed,
        chars,
        maxLength,
        opacity: 0.3 + Math.random() * 0.7,
      });
    }

    columnsRef.current = columns;
    return columns;
  }, [fontSize, density, charset, speed]);

  // Render frame
  const render = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { r, g, b } = parseColor(color);

    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(9, 9, 11, 0.1)'; // Match --background
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${fontSize}px "Sora", monospace`;
    ctx.textAlign = 'center';

    columnsRef.current.forEach((column) => {
      column.chars.forEach((char, i) => {
        const y = column.y + i * fontSize;

        // Skip if off-screen
        if (y < -fontSize || y > height + fontSize) return;

        // Calculate fade based on position in column
        const fadePosition = i / column.maxLength;
        const charOpacity = (1 - fadePosition) * column.opacity * opacity;

        // Head character is brighter
        if (i === 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${charOpacity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${charOpacity})`;
        }

        ctx.fillText(char, column.x, y);
      });

      // Update position
      column.y += column.speed;

      // Reset column when off screen
      if (column.y - column.maxLength * fontSize > height) {
        column.y = -column.maxLength * fontSize;
        // Randomize chars
        column.chars = column.chars.map(() =>
          charset[Math.floor(Math.random() * charset.length)]
        );
        // Slightly randomize speed
        column.speed = (0.5 + Math.random() * 1.5) * speed;
      }

      // Randomly change some characters
      if (Math.random() < 0.02) {
        const idx = Math.floor(Math.random() * column.chars.length);
        column.chars[idx] = charset[Math.floor(Math.random() * charset.length)];
      }
    });
  }, [color, fontSize, charset, speed, opacity, parseColor]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Throttle to ~30fps for performance
    if (timestamp - lastTimeRef.current < 33) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }
    lastTimeRef.current = timestamp;

    render(ctx, canvas.width, canvas.height);
    animationRef.current = requestAnimationFrame(animate);
  }, [render]);

  // Start animation
  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Initialize columns
    initColumns(rect.width, rect.height);

    // Start animation
    animationRef.current = requestAnimationFrame(animate);
  }, [initColumns, animate]);

  // Stop animation
  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        initColumns(rect.width, rect.height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initColumns]);

  return { canvasRef, start, stop };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataStream({
  active = true,
  color = '#9333EA',
  charset = 'hex',
  density = 0.3,
  fontSize = 14,
  speed = 1,
  className,
  children,
  opacity = 0.8,
}: DataStreamProps) {
  const prefersReducedMotion = useReducedMotion();
  const charsetString = useMemo(() => CHARSETS[charset], [charset]);

  const { canvasRef, start, stop } = useDataStreamCanvas({
    color,
    charset: charsetString,
    density,
    fontSize,
    speed,
    opacity,
  });

  // Handle active state
  useEffect(() => {
    if (active && !prefersReducedMotion) {
      start();
    } else {
      stop();
    }

    return stop;
  }, [active, prefersReducedMotion, start, stop]);

  // Reduced motion fallback
  if (prefersReducedMotion) {
    return (
      <div className={cn('relative', className)}>
        {active && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${color}20 50%, transparent 100%)`,
            }}
          />
        )}
        {children}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Data stream canvas */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ display: 'block' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// PRESET VARIANTS
// =============================================================================

/**
 * Dense data stream for dramatic effect
 */
export function DenseDataStream(
  props: Omit<DataStreamProps, 'density'>
) {
  return <DataStream density={0.6} {...props} />;
}

/**
 * Sparse data stream for subtle background
 */
export function SparseDataStream(
  props: Omit<DataStreamProps, 'density'>
) {
  return <DataStream density={0.15} {...props} />;
}

/**
 * Fast data stream for intense loading
 */
export function FastDataStream(
  props: Omit<DataStreamProps, 'speed'>
) {
  return <DataStream speed={2} {...props} />;
}

/**
 * Binary data stream (0s and 1s)
 */
export function BinaryDataStream(
  props: Omit<DataStreamProps, 'charset'>
) {
  return <DataStream charset="binary" {...props} />;
}

/**
 * Blue-tinted data stream
 */
export function BlueDataStream(
  props: Omit<DataStreamProps, 'color'>
) {
  return <DataStream color="#3b82f6" {...props} />;
}

/**
 * Cyan-tinted data stream (TRON style)
 */
export function CyanDataStream(
  props: Omit<DataStreamProps, 'color'>
) {
  return <DataStream color="#06b6d4" {...props} />;
}

// =============================================================================
// FULLSCREEN DATA STREAM BACKGROUND
// =============================================================================

export interface DataStreamBackgroundProps {
  /** Whether effect is active */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Full-screen data stream background
 * Use for loading screens or cinematic moments
 */
export function DataStreamBackground({
  active = true,
  className,
}: DataStreamBackgroundProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className={cn(
            'fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background',
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <DataStream
            active={active}
            density={0.25}
            opacity={0.6}
            className="w-full h-full"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DataStream;
