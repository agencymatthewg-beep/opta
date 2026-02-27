/**
 * usePinchZoom - Trackpad pinch-to-zoom gesture hook
 *
 * Uses @use-gesture for smooth pinch gesture detection on MacBook trackpads.
 * Provides scroll-wheel fallback for mouse users (Ctrl+scroll).
 *
 * Features:
 * - Pinch-to-zoom with configurable bounds
 * - Drag to pan when zoomed in
 * - Scroll-wheel zoom with Ctrl modifier
 * - Reduced motion support
 * - Reset functionality
 *
 * @example
 * ```tsx
 * const { scale, x, y, bind, reset, isZoomed } = usePinchZoom({
 *   minScale: 0.5,
 *   maxScale: 3,
 * });
 *
 * return (
 *   <div {...bind()} style={{ transform: `scale(${scale}) translate(${x}px, ${y}px)` }}>
 *     {children}
 *   </div>
 * );
 * ```
 */

import { useGesture } from '@use-gesture/react';
import { useState, useCallback, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface PinchZoomState {
  /** Current scale factor (1 = 100%) */
  scale: number;
  /** Current X offset when panning */
  x: number;
  /** Current Y offset when panning */
  y: number;
}

export interface UsePinchZoomOptions {
  /** Minimum scale factor (default: 0.5) */
  minScale?: number;
  /** Maximum scale factor (default: 3) */
  maxScale?: number;
  /** Initial scale factor (default: 1) */
  initialScale?: number;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Callback when zoom changes */
  onZoomChange?: (scale: number) => void;
}

export interface UsePinchZoomReturn {
  /** Current scale factor */
  scale: number;
  /** Current X offset */
  x: number;
  /** Current Y offset */
  y: number;
  /** Gesture binding function - spread onto target element */
  bind: ReturnType<typeof useGesture>;
  /** Reset zoom and pan to initial state */
  reset: () => void;
  /** Whether currently zoomed (scale !== 1) */
  isZoomed: boolean;
  /** Set scale programmatically */
  setScale: (scale: number) => void;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Hook for pinch-to-zoom gesture support.
 */
export function usePinchZoom(options: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const {
    minScale = 0.5,
    maxScale = 3,
    initialScale = 1,
    enabled = true,
    onZoomChange,
  } = options;

  const prefersReducedMotion = useReducedMotion();

  const [state, setState] = useState<PinchZoomState>({
    scale: initialScale,
    x: 0,
    y: 0,
  });

  // Track the memo for gesture continuity
  const memoRef = useRef<{ initialScale: number; initialX: number; initialY: number } | null>(null);

  /**
   * Handle pinch gesture for zoom.
   */
  const handlePinch = useCallback(
    ({
      offset: [scale],
      first,
      memo,
    }: {
      offset: [number, number];
      first: boolean;
      memo?: unknown;
    }) => {
      if (!enabled || prefersReducedMotion) return memo;

      if (first) {
        memoRef.current = {
          initialScale: state.scale,
          initialX: state.x,
          initialY: state.y,
        };
      }

      const clampedScale = clamp(scale, minScale, maxScale);

      setState((prev) => ({
        ...prev,
        scale: clampedScale,
      }));

      onZoomChange?.(clampedScale);
      return memo;
    },
    [enabled, prefersReducedMotion, minScale, maxScale, state.scale, state.x, state.y, onZoomChange]
  );

  /**
   * Handle drag gesture for panning when zoomed.
   */
  const handleDrag = useCallback(
    ({
      offset: [x, y],
      memo,
    }: {
      offset: [number, number];
      memo?: unknown;
    }) => {
      if (!enabled) return memo;

      // Only allow dragging when zoomed in
      if (state.scale <= 1) return memo;

      setState((prev) => ({
        ...prev,
        x,
        y,
      }));

      return memo;
    },
    [enabled, state.scale]
  );

  /**
   * Handle scroll wheel for zoom (Ctrl+scroll fallback).
   */
  const handleWheel = useCallback(
    ({
      delta: [, dy],
      event,
      ctrlKey,
    }: {
      delta: [number, number];
      event: WheelEvent;
      ctrlKey: boolean;
    }) => {
      if (!enabled) return;

      // Only handle Ctrl+scroll (pinch-to-zoom also triggers this)
      if (ctrlKey || event.ctrlKey) {
        event.preventDefault();

        const zoomFactor = 0.01;
        const newScale = clamp(state.scale - dy * zoomFactor, minScale, maxScale);

        setState((prev) => ({
          ...prev,
          scale: newScale,
        }));

        onZoomChange?.(newScale);
      }
    },
    [enabled, state.scale, minScale, maxScale, onZoomChange]
  );

  /**
   * Bind gestures to element.
   */
  const bind = useGesture(
    {
      onPinch: handlePinch,
      onDrag: handleDrag,
      onWheel: handleWheel,
    },
    {
      pinch: {
        scaleBounds: { min: minScale, max: maxScale },
        rubberband: true,
      },
      drag: {
        enabled: state.scale > 1,
        bounds: {
          // Limit pan based on zoom level
          left: -100 * (state.scale - 1),
          right: 100 * (state.scale - 1),
          top: -100 * (state.scale - 1),
          bottom: 100 * (state.scale - 1),
        },
        rubberband: true,
      },
      wheel: {
        eventOptions: { passive: false },
      },
    }
  );

  /**
   * Reset zoom and pan to initial state.
   */
  const reset = useCallback(() => {
    setState({
      scale: initialScale,
      x: 0,
      y: 0,
    });
    onZoomChange?.(initialScale);
  }, [initialScale, onZoomChange]);

  /**
   * Set scale programmatically.
   */
  const setScale = useCallback(
    (newScale: number) => {
      const clampedScale = clamp(newScale, minScale, maxScale);
      setState((prev) => ({
        ...prev,
        scale: clampedScale,
        // Reset position when zooming out to 1
        x: clampedScale === 1 ? 0 : prev.x,
        y: clampedScale === 1 ? 0 : prev.y,
      }));
      onZoomChange?.(clampedScale);
    },
    [minScale, maxScale, onZoomChange]
  );

  return {
    scale: state.scale,
    x: state.x,
    y: state.y,
    bind,
    reset,
    isZoomed: state.scale !== 1,
    setScale,
  };
}

export default usePinchZoom;
