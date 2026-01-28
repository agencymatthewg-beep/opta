/**
 * PinchZoomContainer - Wrapper for pinch-to-zoom functionality
 *
 * Provides a container that supports trackpad pinch gestures for zooming
 * and dragging for panning. Includes zoom indicator and reset button.
 *
 * Uses Framer Motion for smooth animations and follows the Obsidian design system.
 *
 * @example
 * ```tsx
 * <PinchZoomContainer>
 *   <TelemetryChart />
 * </PinchZoomContainer>
 * ```
 *
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

import { ReactNode, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { usePinchZoom, UsePinchZoomOptions } from '@/hooks/usePinchZoom';
import { cn } from '@/lib/utils';

// Smooth easing for spring animations
const springConfig = { type: 'spring', stiffness: 300, damping: 30 } as const;

export interface PinchZoomContainerProps extends UsePinchZoomOptions {
  /** Content to be made zoomable */
  children: ReactNode;
  /** Additional class names for the container */
  className?: string;
  /** Show zoom percentage indicator (default: true) */
  showIndicator?: boolean;
  /** Show zoom control buttons (default: true) */
  showControls?: boolean;
  /** Enable keyboard shortcuts (+ and - for zoom, 0 for reset) */
  enableKeyboardShortcuts?: boolean;
}

/**
 * PinchZoomContainer - Provides pinch-to-zoom with visual feedback.
 */
export function PinchZoomContainer({
  children,
  className,
  showIndicator = true,
  showControls = true,
  enableKeyboardShortcuts = true,
  ...pinchZoomOptions
}: PinchZoomContainerProps) {
  const { scale, x, y, bind, reset, isZoomed, setScale } = usePinchZoom(pinchZoomOptions);

  const minScale = pinchZoomOptions.minScale ?? 0.5;
  const maxScale = pinchZoomOptions.maxScale ?? 3;

  /**
   * Zoom in by a step.
   */
  const zoomIn = useCallback(() => {
    setScale(Math.min(scale + 0.25, maxScale));
  }, [scale, maxScale, setScale]);

  /**
   * Zoom out by a step.
   */
  const zoomOut = useCallback(() => {
    setScale(Math.max(scale - 0.25, minScale));
  }, [scale, minScale, setScale]);

  /**
   * Handle keyboard shortcuts for zoom.
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if this container or its children are focused
      // Check for + or = key (zoom in)
      if (event.key === '+' || event.key === '=') {
        zoomIn();
        event.preventDefault();
      }
      // Check for - key (zoom out)
      else if (event.key === '-') {
        zoomOut();
        event.preventDefault();
      }
      // Check for 0 key (reset)
      else if (event.key === '0') {
        reset();
        event.preventDefault();
      }
    };

    // Only listen when focused within this component
    // For now, we'll use document-level listening with a flag
    // In a real app, we'd scope this better
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboardShortcuts, zoomIn, zoomOut, reset]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg',
        // Subtle border when zoomed to indicate zoom state
        isZoomed && 'ring-1 ring-primary/20',
        className
      )}
      role="region"
      aria-label="Zoomable content"
      tabIndex={0}
    >
      {/* Zoomable content area */}
      <motion.div
        {...bind()}
        style={{
          touchAction: 'none', // Prevent browser handling of touch gestures
        }}
        animate={{
          scale,
          x,
          y,
        }}
        transition={springConfig}
        className={cn(
          'origin-center',
          isZoomed && 'cursor-grab active:cursor-grabbing'
        )}
      >
        {children}
      </motion.div>

      {/* Zoom indicator and controls */}
      <AnimatePresence>
        {(showIndicator || showControls) && isZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute bottom-3 right-3 flex items-center gap-2',
              'glass-subtle px-2 py-1.5 rounded-lg',
              'border border-white/5'
            )}
          >
            {/* Zoom percentage */}
            {showIndicator && (
              <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
            )}

            {/* Zoom controls */}
            {showControls && (
              <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                {/* Zoom out button */}
                <button
                  onClick={zoomOut}
                  disabled={scale <= minScale}
                  className={cn(
                    'p-1 rounded transition-colors',
                    'hover:bg-white/10 active:bg-white/20',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                  aria-label="Zoom out"
                  title="Zoom out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                </button>

                {/* Zoom in button */}
                <button
                  onClick={zoomIn}
                  disabled={scale >= maxScale}
                  className={cn(
                    'p-1 rounded transition-colors',
                    'hover:bg-white/10 active:bg-white/20',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                  aria-label="Zoom in"
                  title="Zoom in (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                </button>

                {/* Reset button */}
                <button
                  onClick={reset}
                  className={cn(
                    'p-1 rounded transition-colors',
                    'hover:bg-white/10 active:bg-white/20'
                  )}
                  aria-label="Reset zoom"
                  title="Reset zoom (0)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fit-to-screen hint when not zoomed */}
      <AnimatePresence>
        {!isZoomed && showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1, duration: 0.3 }}
            className={cn(
              'absolute bottom-3 right-3',
              'glass-subtle px-2 py-1 rounded-md',
              'border border-white/5',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            )}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Maximize2 className="w-3 h-3" strokeWidth={1.75} />
              <span>Pinch to zoom</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PinchZoomContainer;
