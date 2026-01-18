/**
 * ChessWidgetStatus - Glanceable status display for collapsed chess widget.
 *
 * Shows:
 * - Your turn indicator (pulsing dot when it's your move)
 * - Daily puzzle status (checkmark if completed, puzzle icon if pending)
 * - Streak count with flame icon
 *
 * Note: Puzzle system doesn't exist yet (Phase 52), using placeholder data.
 *
 * @see DESIGN_SYSTEM.md - Lucide icons, glass styling, CSS variables
 */

import { motion } from 'framer-motion';
import { Circle, Puzzle, Flame, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChessWidgetStatusProps {
  /** Whether it's the player's turn */
  isYourTurn: boolean;
  /** Whether there's a pending daily puzzle (Phase 52 placeholder) */
  hasPendingPuzzle: boolean;
  /** Current puzzle streak count (Phase 52 placeholder) */
  puzzleStreak: number;
  /** Callback when status is clicked to expand widget */
  onClick?: () => void;
}

/**
 * Glanceable status indicators for the collapsed chess widget.
 */
export function ChessWidgetStatus({
  isYourTurn,
  hasPendingPuzzle,
  puzzleStreak,
  onClick,
}: ChessWidgetStatusProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg',
        'hover:bg-white/5 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/50'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Your Turn Indicator */}
      <div className="flex items-center gap-1.5" title={isYourTurn ? 'Your turn' : "Opponent's turn"}>
        {isYourTurn ? (
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Circle
              className="w-3 h-3 text-success fill-success"
              strokeWidth={0}
            />
          </motion.div>
        ) : (
          <Circle
            className="w-3 h-3 text-muted-foreground/40"
            strokeWidth={1.5}
          />
        )}
        <span
          className={cn(
            'text-xs font-medium',
            isYourTurn ? 'text-success' : 'text-muted-foreground/60'
          )}
        >
          {isYourTurn ? 'Your move' : 'Waiting'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      {/* Daily Puzzle Status */}
      <div
        className="flex items-center gap-1.5"
        title={hasPendingPuzzle ? 'Daily puzzle available' : 'Puzzle completed'}
      >
        {hasPendingPuzzle ? (
          <Puzzle
            className="w-3.5 h-3.5 text-primary"
            strokeWidth={1.75}
          />
        ) : (
          <Check
            className="w-3.5 h-3.5 text-success"
            strokeWidth={2}
          />
        )}
      </div>

      {/* Streak Count */}
      {puzzleStreak > 0 && (
        <>
          <div className="w-px h-4 bg-white/10" />
          <div
            className="flex items-center gap-1"
            title={`${puzzleStreak} day streak`}
          >
            <Flame
              className={cn(
                'w-3.5 h-3.5',
                puzzleStreak >= 7 ? 'text-warning' : 'text-muted-foreground/60'
              )}
              strokeWidth={1.75}
            />
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                puzzleStreak >= 7 ? 'text-warning' : 'text-muted-foreground/60'
              )}
            >
              {puzzleStreak}
            </span>
          </div>
        </>
      )}
    </motion.button>
  );
}

export default ChessWidgetStatus;
