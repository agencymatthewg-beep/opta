import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DetectedGame } from '../types/games';
import { HardDrive, CheckCircle, Play, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Launcher configuration for styling and icons.
 * Uses semantic CSS variables per DESIGN_SYSTEM.md.
 */
const LAUNCHER_CONFIG = {
  steam: {
    name: 'Steam',
    color: 'from-primary/20 to-primary/10',
    textColor: 'text-primary',
    borderColor: 'border-primary/30',
    glowColor: 'hover:shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.4)]',
  },
  epic: {
    name: 'Epic',
    color: 'from-muted/20 to-muted/10',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border',
    glowColor: 'hover:shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.3)]',
  },
  gog: {
    name: 'GOG',
    color: 'from-accent/20 to-accent/10',
    textColor: 'text-accent',
    borderColor: 'border-accent/30',
    glowColor: 'hover:shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.4)]',
  },
} as const;

type LauncherId = keyof typeof LAUNCHER_CONFIG;

/**
 * Format file size from bytes to human-readable string.
 */
function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '--';

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Props for the GameCard component.
 */
export interface GameCardProps {
  /** The detected game to display */
  game: DetectedGame;
  /** Whether optimization settings are available for this game */
  hasOptimization: boolean;
  /** Callback when the card is clicked */
  onClick: () => void;
  /** Callback when the Play button is clicked */
  onPlay?: () => void;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Whether a launch is in progress for this game */
  isLaunching?: boolean;
  /** Whether this game is currently being played */
  isPlaying?: boolean;
  /** Animation delay for staggered reveals */
  delay?: number;
}

/**
 * GameCard - Displays a single game with launcher badge and optimization indicator.
 * Memoized to prevent re-renders when game data hasn't changed.
 */
const GameCard = memo(function GameCard({
  game,
  hasOptimization,
  onClick,
  onPlay,
  isSelected = false,
  isLaunching = false,
  isPlaying = false,
  delay = 0,
}: GameCardProps) {
  const launcherId = game.launcher.toLowerCase() as LauncherId;
  const launcher = LAUNCHER_CONFIG[launcherId] || LAUNCHER_CONFIG.steam;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.();
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-xl',
        'glass border transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isPlaying
          ? 'border-success/50 shadow-[0_0_24px_-8px_hsl(var(--success)/0.5)]'
          : isSelected
          ? 'border-primary/50 shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.5)]'
          : 'border-border/30 hover:border-primary/30',
        !isPlaying && launcher.glowColor
      )}
    >
      {/* Gradient overlay based on launcher or playing state */}
      <div
        className={cn(
          'absolute top-0 left-0 w-full h-1.5 rounded-t-xl bg-gradient-to-r',
          isPlaying ? 'from-success/40 to-success/20' : launcher.color
        )}
      />

      {/* Now Playing indicator */}
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-3 right-3 z-10"
        >
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold',
              'bg-success/20 text-success border border-success/40',
              'shadow-[0_0_12px_-2px_hsl(var(--success)/0.4)]'
            )}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Radio className="w-3 h-3" strokeWidth={2.5} />
            </motion.div>
            Now Playing
          </span>
        </motion.div>
      )}

      <div className="p-4 pt-5">
        {/* Header with game name and launcher badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-medium text-foreground line-clamp-2 leading-tight">
            {game.name}
          </h3>

          {/* Launcher Badge - hidden when playing (Now Playing badge takes its place) */}
          {!isPlaying && (
            <span
              className={cn(
                'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                launcher.textColor,
                launcher.borderColor,
                'bg-background/50 backdrop-blur-sm'
              )}
            >
              {launcher.name}
            </span>
          )}
        </div>

        {/* Game details */}
        <div className="space-y-2">
          {/* Install size */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
            <HardDrive className="w-4 h-4" strokeWidth={1.5} />
            <span className="tabular-nums">{formatSize(game.size_bytes)}</span>
          </div>

          {/* Optimization indicator */}
          {hasOptimization && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.1 }}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium',
                'bg-success/15 text-success border border-success/30'
              )}
            >
              <CheckCircle className="w-3 h-3" strokeWidth={2} />
              Optimizations Available
            </motion.span>
          )}

          {/* Play button - hidden when playing */}
          {onPlay && !isPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.15 }}
              className="mt-3"
            >
              <Button
                onClick={handlePlayClick}
                disabled={isLaunching}
                className={cn(
                  'w-full gap-2 rounded-xl',
                  'bg-gradient-to-r from-primary to-accent',
                  'shadow-[0_0_12px_-4px_hsl(var(--glow-primary)/0.4)]',
                  'hover:shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.6)]',
                  'transition-shadow duration-300'
                )}
              >
                {isLaunching ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Launching...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" strokeWidth={2} fill="currentColor" />
                    Play
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default GameCard;
