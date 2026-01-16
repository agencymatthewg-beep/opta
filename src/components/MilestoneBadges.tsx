/**
 * MilestoneBadges - The Obsidian Achievement Panel
 *
 * Badge display with obsidian glass styling and energy unlock effects.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BadgeCard } from './BadgeCard';
import { useBadges } from '@/hooks/useBadges';
import type { BadgeCategory } from '@/types/badges';
import { Award, Sparkles } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface MilestoneBadgesProps {
  compact?: boolean;  // Show fewer badges
  category?: BadgeCategory;  // Filter by category
}

export function MilestoneBadges({ compact, category }: MilestoneBadgesProps) {
  const { badges, newUnlocks, loading, markBadgeSeen } = useBadges();

  const filteredBadges = category
    ? badges.filter(b => b.category === category)
    : badges;

  const displayBadges = compact
    ? filteredBadges.slice(0, 4)
    : filteredBadges;

  const unlockedCount = filteredBadges.filter(b => b.unlockedAt !== null).length;

  if (loading) {
    return <BadgesSkeleton compact={compact} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
      className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold">Milestones</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {unlockedCount}/{filteredBadges.length} unlocked
        </span>
      </div>

      {/* New unlock notification */}
      <AnimatePresence>
        {newUnlocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-success/10 border border-success/30"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-success" strokeWidth={1.75} />
              <span className="text-sm font-medium text-success">
                {newUnlocks.length} new badge{newUnlocks.length > 1 ? 's' : ''} unlocked!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge grid */}
      <div className={cn(
        'grid gap-3',
        compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'
      )}>
        {displayBadges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <BadgeCard
              badge={badge}
              onClick={() => badge.isNew && markBadgeSeen(badge.id)}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function BadgesSkeleton({ compact }: { compact?: boolean }) {
  const count = compact ? 4 : 8;
  return (
    <div className={cn(
      "rounded-xl p-4",
      "bg-[#05030a]/80 backdrop-blur-xl",
      "border border-white/[0.06]"
    )}>
      <div className="h-6 w-32 rounded bg-white/[0.04] animate-pulse mb-4" />
      <div className={cn(
        'grid gap-3',
        compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'
      )}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
