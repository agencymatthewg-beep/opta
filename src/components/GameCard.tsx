import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DetectedGame } from '../types/games';
import { HardDrive, CheckCircle, Play, Radio } from 'lucide-react';
import { MotionButton } from '@/components/ui/button';
import { OptaRingLoader } from './OptaRing';

/**
 * GameCard - The Obsidian Game Display
 *
 * Shows a detected game with launcher badge, optimization status,
 * and play button. Uses obsidian glass material with 0%→50% energy
 * transitions on hover/selection.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Launcher configuration for styling and icons.
 * Uses semantic CSS variables per DESIGN_SYSTEM.md.
 */
const LAUNCHER_CONFIG = {
  steam: {
    name: 'Steam',
    textColor: 'text-primary',
    borderColor: 'border-primary/30',
  },
  epic: {
    name: 'Epic',
    textColor: 'text-muted-foreground',
    borderColor: 'border-white/[0.08]',
  },
  gog: {
    name: 'GOG',
    textColor: 'text-accent',
    borderColor: 'border-accent/30',
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
 * GameCard - Displays a single game with obsidian glass styling.
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
  const [isHovered, setIsHovered] = useState(false);
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
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      // Ignition animation - emerges from darkness
      initial={{
        opacity: 0,
        y: 12,
        filter: 'brightness(0.5) blur(2px)',
      }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'brightness(1) blur(0px)',
      }}
      transition={{
        delay,
        duration: 0.5,
        ease: smoothOut,
      }}
      // Hover: 0% → 50% energy lift
      whileHover={{
        y: -4,
        transition: { duration: 0.3, ease: smoothOut },
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-xl group',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl',
        // Focus ring for accessibility
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Playing state - success energy
        isPlaying && [
          'border-success/40',
          'shadow-[inset_0_0_20px_rgba(34,197,94,0.1),0_0_25px_-5px_rgba(34,197,94,0.35)]',
        ],
        // Selected state - primary energy
        !isPlaying && isSelected && [
          'border-primary/40',
          'shadow-[inset_0_0_20px_rgba(168,85,247,0.1),0_0_25px_-5px_rgba(168,85,247,0.35)]',
        ]
      )}
    >
      {/* Hover glow overlay - 0% → 50% energy */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Border glow on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl"
        animate={{
          boxShadow: isHovered && !isPlaying && !isSelected
            ? 'inset 0 0 0 1px rgba(168, 85, 247, 0.2), 0 0 20px -5px rgba(168, 85, 247, 0.25)'
            : 'inset 0 0 0 1px transparent, 0 0 0px transparent',
        }}
        transition={{ duration: 0.3, ease: smoothOut }}
      />

      {/* Top accent bar - energy state indicator */}
      <motion.div
        className={cn(
          'absolute top-0 left-0 w-full h-1 rounded-t-xl z-20',
          isPlaying
            ? 'bg-gradient-to-r from-success/60 via-success/40 to-success/20'
            : 'bg-gradient-to-r from-primary/30 via-primary/20 to-transparent'
        )}
        animate={{
          opacity: isPlaying || isSelected || isHovered ? 1 : 0.5,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Now Playing indicator */}
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, filter: 'brightness(0.5)' }}
          animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
          transition={{ duration: 0.4, ease: smoothOut }}
          className="absolute top-3 right-3 z-10"
        >
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold',
              'bg-success/15 text-success border border-success/30',
              'shadow-[0_0_15px_-3px_rgba(34,197,94,0.5)]',
              'backdrop-blur-sm'
            )}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Radio className="w-3 h-3" strokeWidth={2.5} />
            </motion.div>
            Now Playing
          </span>
        </motion.div>
      )}

      <div className="relative p-4 pt-5">
        {/* Header with game name and launcher badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3
            className={cn(
              'font-medium line-clamp-2 leading-tight transition-colors duration-300',
              isHovered || isSelected
                ? 'text-foreground'
                : 'text-muted-foreground group-hover:text-foreground'
            )}
          >
            {game.name}
          </h3>

          {/* Launcher Badge - hidden when playing */}
          {!isPlaying && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.1, duration: 0.3, ease: smoothOut }}
              className={cn(
                'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                'bg-white/[0.03] backdrop-blur-sm border',
                launcher.textColor,
                launcher.borderColor
              )}
            >
              {launcher.name}
            </motion.span>
          )}
        </div>

        {/* Game details */}
        <div className="space-y-2">
          {/* Install size */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
            <HardDrive className="w-4 h-4" strokeWidth={1.5} />
            <span className="tabular-nums">{formatSize(game.size_bytes)}</span>
          </div>

          {/* Optimization indicator */}
          {hasOptimization && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9, filter: 'brightness(0.5)' }}
              animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
              transition={{ delay: delay + 0.15, duration: 0.4, ease: smoothOut }}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium',
                'bg-success/10 text-success border border-success/25',
                'shadow-[0_0_8px_-2px_rgba(34,197,94,0.3)]'
              )}
            >
              <CheckCircle className="w-3 h-3" strokeWidth={2} />
              Optimizations Available
            </motion.span>
          )}

          {/* Play button - hidden when playing */}
          {onPlay && !isPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'brightness(0.5)' }}
              animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
              transition={{ delay: delay + 0.2, duration: 0.4, ease: smoothOut }}
              className="mt-3"
            >
              <MotionButton
                onClick={handlePlayClick}
                disabled={isLaunching}
                variant="energy"
                className="w-full gap-2"
              >
                {isLaunching ? (
                  <>
                    <OptaRingLoader size="xs" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" strokeWidth={2} fill="currentColor" />
                    Play
                  </>
                )}
              </MotionButton>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default GameCard;
