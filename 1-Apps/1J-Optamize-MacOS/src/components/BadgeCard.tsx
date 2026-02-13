/**
 * BadgeCard - The Obsidian Achievement Display
 *
 * Shows achievement badges with rarity-based energy states.
 * Unlocked badges glow with rarity-appropriate colors.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Badge } from '@/types/badges';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface BadgeCardProps {
  badge: Badge;
  onClick?: () => void;
}

const rarityColors: Record<string, string> = {
  common: 'border-white/[0.08] text-muted-foreground',
  rare: 'border-primary/40 text-primary',
  epic: 'border-accent/40 text-accent',
  legendary: 'border-warning/40 text-warning'
};

const rarityGlows: Record<string, string> = {
  common: 'shadow-[inset_0_0_15px_rgba(255,255,255,0.03)]',
  rare: 'shadow-[inset_0_0_20px_rgba(168,85,247,0.1),0_0_20px_-5px_rgba(168,85,247,0.35)]',
  epic: 'shadow-[inset_0_0_20px_rgba(147,51,234,0.1),0_0_25px_-5px_rgba(147,51,234,0.4)]',
  legendary: 'shadow-[inset_0_0_25px_rgba(234,179,8,0.15),0_0_30px_-5px_rgba(234,179,8,0.5)]'
};

const rarityIconGlows: Record<string, string> = {
  common: '',
  rare: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]',
  epic: 'drop-shadow-[0_0_10px_rgba(147,51,234,0.6)]',
  legendary: 'drop-shadow-[0_0_12px_rgba(234,179,8,0.7)]'
};

export function BadgeCard({ badge, onClick }: BadgeCardProps) {
  // Get icon component from lucide-react dynamically
  const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[badge.icon];
  const isUnlocked = badge.unlockedAt !== null;

  // Get the text color from the rarity classes
  const getRarityTextColor = (rarity: string): string => {
    const colorMap: Record<string, string> = {
      common: 'text-muted-foreground',
      rare: 'text-primary',
      epic: 'text-accent',
      legendary: 'text-warning'
    };
    return colorMap[rarity] || 'text-muted-foreground';
  };

  return (
    <motion.button
      onClick={onClick}
      // Ignition animation
      initial={{
        opacity: 0,
        scale: 0.95,
        filter: 'brightness(0.5) blur(2px)',
      }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: 'brightness(1) blur(0px)',
      }}
      transition={{ duration: 0.5, ease: smoothOut }}
      // Hover: 0% → 50% energy
      whileHover={{
        scale: 1.05,
        y: -3,
        transition: { duration: 0.3, ease: smoothOut },
      }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative p-4 rounded-xl border text-center group',
        // Obsidian glass material
        'glass',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl',
        // Rarity styling
        isUnlocked ? rarityColors[badge.rarity] : 'border-white/[0.04] opacity-50',
        isUnlocked && rarityGlows[badge.rarity]
      )}
    >
      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* New indicator */}
      <AnimatePresence>
        {badge.isNew && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              'absolute -top-1 -right-1 w-3 h-3 rounded-full',
              'bg-danger shadow-[0_0_10px_2px_rgba(239,68,68,0.5)]'
            )}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <div className={cn(
        'relative w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center',
        // Obsidian glass for icon container
        'glass-subtle',
        'border border-white/[0.06]',
        isUnlocked && 'border-' + (badge.rarity === 'common' ? 'white/[0.08]' : badge.rarity === 'rare' ? 'primary/30' : badge.rarity === 'epic' ? 'accent/30' : 'warning/30')
      )}>
        {IconComponent ? (
          <IconComponent
            className={cn(
              'w-6 h-6 transition-all duration-300',
              isUnlocked
                ? cn(getRarityTextColor(badge.rarity), rarityIconGlows[badge.rarity])
                : 'text-muted-foreground/30'
            )}
            strokeWidth={1.75}
          />
        ) : (
          <Icons.Award
            className={cn(
              'w-6 h-6 transition-all duration-300',
              isUnlocked
                ? cn(getRarityTextColor(badge.rarity), rarityIconGlows[badge.rarity])
                : 'text-muted-foreground/30'
            )}
            strokeWidth={1.75}
          />
        )}
      </div>

      {/* Name */}
      <p className={cn(
        'relative text-sm font-medium mb-1 transition-colors duration-300',
        isUnlocked
          ? 'text-foreground group-hover:text-white'
          : 'text-muted-foreground/50'
      )}>
        {badge.name}
      </p>

      {/* Progress bar (if not unlocked) */}
      {!isUnlocked && (
        <div className={cn(
          'relative h-1 rounded-full overflow-hidden',
          'bg-white/[0.03]'
        )}>
          <motion.div
            className="h-full bg-primary/50 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${badge.progress}%` }}
            transition={{ duration: 0.5, ease: smoothOut }}
          />
        </div>
      )}

      {/* Rarity label */}
      <p className="relative text-xs text-muted-foreground/40 mt-1 capitalize">
        {badge.rarity}
      </p>
    </motion.button>
  );
}
