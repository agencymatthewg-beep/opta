import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WowFactors } from '@/types/scoring';
import { DollarSign, TrendingUp, Award, Sparkles } from 'lucide-react';

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-border/30"
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
      className="flex items-start gap-3 p-3 rounded-lg glass-subtle"
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
