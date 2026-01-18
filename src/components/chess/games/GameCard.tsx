/**
 * GameCard - Single game display card for the game browser.
 *
 * Shows:
 * - Opponent name and rating
 * - Result with visual indicator
 * - Time control and opening
 * - Date played
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { motion } from 'framer-motion';
import {
  Trophy,
  XCircle,
  Minus,
  Clock,
  Zap,
  Timer,
  Hourglass,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchivedGame, TimeControlCategory } from '@/types/gameArchive';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface GameCardProps {
  /** The game to display */
  game: ArchivedGame;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card is selected */
  isSelected?: boolean;
}

/**
 * Get icon component for time control category.
 */
function getCategoryIcon(category: TimeControlCategory) {
  switch (category) {
    case 'bullet':
      return Zap;
    case 'blitz':
      return Timer;
    case 'rapid':
      return Clock;
    case 'classical':
      return Hourglass;
    case 'correspondence':
      return Mail;
  }
}

/**
 * Format date for display.
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString();
}

/**
 * GameCard component.
 */
export function GameCard({ game, onClick, isSelected = false }: GameCardProps) {
  const CategoryIcon = getCategoryIcon(game.category);

  // Result styling
  const resultConfig = {
    win: {
      icon: Trophy,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      label: 'Win',
    },
    loss: {
      icon: XCircle,
      color: 'text-danger',
      bg: 'bg-danger/10',
      border: 'border-danger/30',
      label: 'Loss',
    },
    draw: {
      icon: Minus,
      color: 'text-muted-foreground',
      bg: 'bg-muted/10',
      border: 'border-muted/30',
      label: 'Draw',
    },
  }[game.result];

  const ResultIcon = resultConfig.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: smoothOut }}
      className={cn(
        'w-full text-left p-3 rounded-xl',
        'glass',
        'border border-white/[0.06]',
        'transition-all duration-200',
        isSelected && 'ring-2 ring-primary/50 border-primary/30',
        !isSelected && 'hover:border-white/[0.12]'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Result indicator */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg',
            resultConfig.bg,
            'border',
            resultConfig.border
          )}
        >
          <ResultIcon
            className={cn('w-5 h-5', resultConfig.color)}
            strokeWidth={1.75}
          />
        </div>

        {/* Game info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">
              {game.opponent.username}
            </span>
            {game.opponent.rating && (
              <span className="text-xs text-muted-foreground/70">
                ({game.opponent.rating})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {/* Time control */}
            <div className="flex items-center gap-1 text-muted-foreground/60">
              <CategoryIcon className="w-3 h-3" strokeWidth={1.75} />
              <span className="text-[11px]">{game.timeControl.display}</span>
            </div>

            {/* Opening */}
            {game.opening && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[11px] text-muted-foreground/60 truncate max-w-[120px]">
                  {game.opening}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Date and arrow */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground/50">
            {formatDate(game.playedAt)}
          </span>
          <ChevronRight
            className="w-4 h-4 text-muted-foreground/30"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </motion.button>
  );
}

export default GameCard;
