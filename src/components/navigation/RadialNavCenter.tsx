import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRadialNav, type SemanticColorKey } from '@/contexts/RadialNavContext';

/**
 * RadialNavCenter - The HERO element: animated "Opta" text that morphs with semantic colors.
 *
 * This is the most polished obsidian text in the app after the O logo.
 * Features premium moonlight gradient typography with breathing glow animation.
 *
 * States:
 * - Idle: Premium "Opta" text with breathing glow and "OPTIMIZER" subtitle
 * - Hover: Morphs to show hovered item label with semantic color
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface RadialNavCenterProps {
  /** Called when center is clicked - opens utility island */
  onClick?: () => void;
}

/**
 * Label mapping for nav items
 * Capitalizes first letter for display
 */
const ITEM_LABELS: Record<SemanticColorKey, string> = {
  dashboard: 'Dashboard',
  games: 'Games',
  chess: 'Chess',
  optimize: 'Optimize',
  pinpoint: 'Pinpoint',
  score: 'Score',
  settings: 'Settings',
};

/**
 * Default glow color for idle state
 */
const IDLE_GLOW = 'rgba(255, 255, 255, 0.1)';
const IDLE_GLOW_SECONDARY = 'rgba(168, 85, 247, 0.15)';

export function RadialNavCenter({ onClick }: RadialNavCenterProps) {
  const { hoveredItemId, isHomeView, goHome, toggleUtilityIsland, getSemanticColor } = useRadialNav();

  // Determine display text and colors
  const isHovered = !!hoveredItemId;
  const semanticColor = hoveredItemId ? getSemanticColor(hoveredItemId) : null;
  const displayText = isHovered && hoveredItemId in ITEM_LABELS
    ? ITEM_LABELS[hoveredItemId as SemanticColorKey]
    : 'Opta';
  const glowColor = semanticColor?.glow ?? IDLE_GLOW;

  // Handle click action
  // - If NOT in home view: return to home view
  // - If in home view: toggle utility island
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (!isHomeView) {
      goHome();
    } else {
      toggleUtilityIsland();
    }
  }, [onClick, isHomeView, goHome, toggleUtilityIsland]);

  // Handle keyboard activation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <motion.div
      className={cn(
        'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-28 h-28 rounded-full',
        'bg-[#05030a]/90 backdrop-blur-2xl',
        'border border-white/[0.08]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
        'flex flex-col items-center justify-center',
        'cursor-pointer select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
      )}
      role="button"
      tabIndex={0}
      aria-label={
        isHovered
          ? `Navigate to ${displayText}`
          : isHomeView
            ? 'Opta - Click to open utility island'
            : 'Opta - Click to return to home'
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // Breathing animation only when idle
      animate={
        !isHovered
          ? {
              filter: [
                'brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.1))',
                'brightness(1.15) drop-shadow(0 0 35px rgba(255,255,255,0.2))',
                'brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.1))',
              ],
            }
          : {
              filter: 'brightness(1)',
            }
      }
      transition={
        !isHovered
          ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="text-center">
        {/* Main text with AnimatePresence for smooth morphing */}
        <AnimatePresence mode="wait">
          <motion.span
            key={displayText}
            className={cn(
              'block text-4xl font-bold tracking-tight',
              // Default moonlight gradient when not hovered
              !isHovered &&
                'bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent'
            )}
            style={{
              // When hovered, use semantic color
              color: isHovered ? semanticColor?.color : undefined,
              textShadow: `
                0 0 40px ${glowColor},
                0 0 80px ${IDLE_GLOW_SECONDARY},
                0 2px 4px rgba(0, 0, 0, 0.3)
              `,
            }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: isHovered ? 1.05 : 1,
            }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {displayText}
          </motion.span>
        </AnimatePresence>

        {/* Subtitle - only visible when idle */}
        <AnimatePresence>
          {!isHovered && (
            <motion.p
              className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.3em] mt-1"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              Optimizer
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default RadialNavCenter;
