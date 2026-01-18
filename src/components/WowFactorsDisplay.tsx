/**
 * WowFactorsDisplay - The Obsidian Highlights Panel
 *
 * Shareable viral metrics with obsidian glass styling and energy effects.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WowFactors } from '@/types/scoring';
import { DollarSign, TrendingUp, Award, Sparkles } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface WowFactorsDisplayProps {
  wowFactors: WowFactors;
  animate?: boolean;  // Trigger count-up animations
}

/**
 * WowFactorsDisplay - Shows shareable viral metrics.
 * Displays money saved, percentile rank, and biggest improvement.
 */
export function WowFactorsDisplay({ wowFactors, animate }: WowFactorsDisplayProps) {
  const { moneySaved, percentileRank, improvementSummary } = wowFactors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
      className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "glass",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-warning" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold">Your Highlights</h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Money Saved */}
        <WowFactorCard
          icon={DollarSign}
          label="Equivalent Upgrade"
          value={`$${moneySaved.amount}`}
          description={moneySaved.equivalent}
          colorClass="success"
          animate={animate}
        />

        {/* Percentile Rank */}
        <WowFactorCard
          icon={TrendingUp}
          label="Your Ranking"
          value={`Top ${100 - percentileRank.similar}%`}
          description={`Among ${percentileRank.tier} builds`}
          colorClass="primary"
          animate={animate}
        />

        {/* Biggest Gain */}
        <WowFactorCard
          icon={Award}
          label="Biggest Win"
          value={improvementSummary.biggestGain}
          description={`${improvementSummary.totalOptimizations} optimizations applied`}
          colorClass="accent"
          animate={animate}
        />
      </div>
    </motion.div>
  );
}

interface WowFactorCardProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  description: string;
  colorClass: 'success' | 'primary' | 'accent';
  animate?: boolean;
}

const colorMap = {
  success: {
    bg: 'bg-success/15',
    border: 'border-success/30',
    text: 'text-success'
  },
  primary: {
    bg: 'bg-primary/15',
    border: 'border-primary/30',
    text: 'text-primary'
  },
  accent: {
    bg: 'bg-accent/15',
    border: 'border-accent/30',
    text: 'text-accent'
  }
};

function WowFactorCard({
  icon: Icon,
  label,
  value,
  description,
  colorClass,
  animate
}: WowFactorCardProps) {
  const colors = colorMap[colorClass];

  return (
    <motion.div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        // Obsidian subtle glass
        "bg-white/[0.02]",
        "border border-white/[0.04]",
        // Hover energy state
        "hover:bg-primary/[0.05] hover:border-primary/20",
        "transition-colors duration-200"
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center border',
        colors.bg,
        colors.border
      )}>
        <Icon className={cn('w-5 h-5', colors.text)} strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <motion.p
          className={cn('text-lg font-bold', colors.text)}
          initial={animate ? { opacity: 0, scale: 0.5 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {value}
        </motion.p>
        <p className="text-xs text-muted-foreground/70">{description}</p>
      </div>
    </motion.div>
  );
}

export default WowFactorsDisplay;
