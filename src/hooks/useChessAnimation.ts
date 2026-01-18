/**
 * useChessAnimation - Hook for chess animation settings
 *
 * Provides easy access to animation settings with computed values.
 * Automatically converts speed presets to milliseconds for use
 * with react-chessboard and Framer Motion.
 *
 * Features:
 * - Converts speed presets to milliseconds
 * - Provides spring configurations for Framer Motion
 * - Exposes animation toggle states
 *
 * @example
 * ```tsx
 * const { moveAnimationMs, springConfig, boardFlipEnabled } = useChessAnimation(settings.animation);
 *
 * <Chessboard animationDurationInMs={moveAnimationMs} />
 * <motion.div transition={springConfig}>
 * ```
 */

import { useMemo } from 'react';
import type { ChessAnimationSettings, AnimationSpeed } from '@/types/chess';
import { ANIMATION_SPEED_MS } from '@/types/chess';

/**
 * Spring configuration for Framer Motion
 */
export interface SpringConfig {
  type: 'spring' | 'tween';
  stiffness?: number;
  damping?: number;
  duration?: number;
}

export interface UseChessAnimationReturn {
  /** Move animation duration in milliseconds */
  moveAnimationMs: number;
  /** Current speed preset name */
  speed: AnimationSpeed;
  /** Highlight effect duration in milliseconds */
  highlightDurationMs: number;
  /** Whether board flip animation is enabled */
  boardFlipEnabled: boolean;
  /** Whether piece drop bounce is enabled */
  pieceDropBounce: boolean;
  /** Spring config for Framer Motion based on speed */
  springConfig: SpringConfig;
  /** Tween config for Framer Motion based on speed */
  tweenConfig: { duration: number };
  /** Whether animations are instant (disabled) */
  isInstant: boolean;
}

/**
 * Get spring configuration based on animation speed
 */
function getSpringConfig(speed: AnimationSpeed): SpringConfig {
  switch (speed) {
    case 'instant':
      return { type: 'tween', duration: 0 };
    case 'fast':
      return { type: 'spring', stiffness: 600, damping: 35 };
    case 'normal':
      return { type: 'spring', stiffness: 400, damping: 30 };
    case 'slow':
      return { type: 'spring', stiffness: 200, damping: 25 };
    default:
      return { type: 'spring', stiffness: 400, damping: 30 };
  }
}

/**
 * Hook for chess animation settings
 */
export function useChessAnimation(animationSettings: ChessAnimationSettings): UseChessAnimationReturn {
  const moveAnimationMs = useMemo(
    () => ANIMATION_SPEED_MS[animationSettings.moveAnimationSpeed],
    [animationSettings.moveAnimationSpeed]
  );

  const speed = animationSettings.moveAnimationSpeed;

  const highlightDurationMs = animationSettings.highlightDuration;

  const boardFlipEnabled = animationSettings.boardFlipAnimation;

  const pieceDropBounce = animationSettings.pieceDropBounce;

  const springConfig = useMemo(
    () => getSpringConfig(animationSettings.moveAnimationSpeed),
    [animationSettings.moveAnimationSpeed]
  );

  const tweenConfig = useMemo(
    () => ({ duration: moveAnimationMs / 1000 }),
    [moveAnimationMs]
  );

  const isInstant = animationSettings.moveAnimationSpeed === 'instant';

  return {
    moveAnimationMs,
    speed,
    highlightDurationMs,
    boardFlipEnabled,
    pieceDropBounce,
    springConfig,
    tweenConfig,
    isInstant,
  };
}

export default useChessAnimation;
