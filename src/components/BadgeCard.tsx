import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Badge } from '@/types/badges';

interface BadgeCardProps {
  badge: Badge;
  onClick?: () => void;
}

const rarityColors: Record<string, string> = {
  common: 'border-muted-foreground/30 text-muted-foreground',
  rare: 'border-primary/50 text-primary',
  epic: 'border-accent/50 text-accent',
  legendary: 'border-warning/50 text-warning'
};

const rarityGlows: Record<string, string> = {
  common: '',
  rare: 'shadow-[0_0_12px_-4px_hsl(var(--glow-primary)/0.3)]',
  epic: 'shadow-[0_0_16px_-4px_hsl(var(--accent)/0.4)]',
  legendary: 'shadow-[0_0_20px_-4px_hsl(var(--glow-warning)/0.5)]'
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
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-4 rounded-xl border-2 text-center',
        'glass',
        isUnlocked ? rarityColors[badge.rarity] : 'border-border/20 opacity-50',
        isUnlocked && rarityGlows[badge.rarity]
      )}
    >
      {/* New indicator */}
      {badge.isNew && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-danger"
        />
      )}

      {/* Icon */}
      <div className={cn(
        'w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center',
        isUnlocked ? 'glass' : 'bg-muted/20'
      )}>
        {IconComponent ? (
          <IconComponent className={cn(
            'w-6 h-6',
            isUnlocked ? getRarityTextColor(badge.rarity) : 'text-muted-foreground/30'
          )} strokeWidth={1.75} />
        ) : (
          <Icons.Award className={cn(
            'w-6 h-6',
            isUnlocked ? getRarityTextColor(badge.rarity) : 'text-muted-foreground/30'
          )} strokeWidth={1.75} />
        )}
      </div>

      {/* Name */}
      <p className={cn(
        'text-sm font-medium mb-1',
        !isUnlocked && 'text-muted-foreground/50'
      )}>
        {badge.name}
      </p>

      {/* Progress bar (if not unlocked) */}
      {!isUnlocked && (
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full bg-primary/50 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${badge.progress}%` }}
          />
        </div>
      )}

      {/* Rarity label */}
      <p className="text-xs text-muted-foreground/50 mt-1 capitalize">
        {badge.rarity}
      </p>
    </motion.button>
  );
}
