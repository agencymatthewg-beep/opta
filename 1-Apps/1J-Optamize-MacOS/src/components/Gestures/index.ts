/**
 * Gestures Module - Trackpad gesture support for Opta
 *
 * Provides trackpad-friendly gesture components and hooks:
 * - PinchZoomContainer: Pinch-to-zoom wrapper for charts/content
 * - GestureHints: Educational hints showing available gestures
 *
 * Uses @use-gesture for reliable cross-platform gesture detection.
 *
 * @example
 * ```tsx
 * import { PinchZoomContainer, GestureHints } from '@/components/Gestures';
 *
 * <PinchZoomContainer>
 *   <Chart />
 * </PinchZoomContainer>
 * ```
 *
 * @see 20-05-PLAN.md - Trackpad Gestures Plan
 */

export { PinchZoomContainer, type PinchZoomContainerProps } from './PinchZoomContainer';
export {
  GestureHints,
  resetGestureHintsDismissed,
  type GestureHintsProps,
  type GestureHintType,
} from './GestureHints';
