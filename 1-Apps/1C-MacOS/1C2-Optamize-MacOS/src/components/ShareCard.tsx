import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { OptaScore } from '@/types/scoring';
import { Award, Zap, Eye, Target, DollarSign, TrendingUp, Sparkles } from 'lucide-react';

interface ShareCardProps {
  score: OptaScore;
  className?: string;
}

/**
 * ShareCard - Static score card optimized for image export.
 * Fixed dimensions (1200x630) optimized for Twitter/social sharing.
 * No animations - pure static render for html2canvas capture.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ score, className }, ref) => {
    const { overall, dimensions, wowFactors, hardwareTier } = score;

    return (
      <div
        ref={ref}
        className={cn(
          'w-[1200px] h-[630px] p-8 flex flex-col',
          'bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]',
          'font-[Sora] text-white',
          className
        )}
        style={{ fontFamily: 'Sora, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Award className="w-6 h-6 text-emerald-400" strokeWidth={1.75} />
            </div>
            <span className="text-2xl font-bold text-emerald-400">Opta</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10">
            <span className="text-sm text-white/60">{hardwareTier.signature}</span>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 flex gap-8">
          {/* Left - Score Circle & Dimensions */}
          <div className="flex-1 flex flex-col">
            {/* Score Circle */}
            <div className="flex items-center gap-8 mb-8">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                <span className="text-6xl font-bold bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
                  {overall}
                </span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
                  Opta Score
                </h1>
                <p className="text-lg text-white/50 mt-2">
                  {hardwareTier.tier.charAt(0).toUpperCase() + hardwareTier.tier.slice(1)} Tier
                </p>
              </div>
            </div>

            {/* Dimension Scores */}
            <div className="grid grid-cols-3 gap-4">
              <DimensionCard
                icon={Zap}
                label="Performance"
                value={Math.round(dimensions.performance.weighted)}
                color="emerald"
              />
              <DimensionCard
                icon={Eye}
                label="Experience"
                value={Math.round(dimensions.experience.weighted)}
                color="purple"
              />
              <DimensionCard
                icon={Target}
                label="Competitive"
                value={Math.round(dimensions.competitive.weighted)}
                color="cyan"
              />
            </div>
          </div>

          {/* Right - Wow Factors */}
          <div className="w-[400px] flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" strokeWidth={1.75} />
              <h2 className="text-lg font-semibold text-white/80">Highlights</h2>
            </div>

            <WowFactorItem
              icon={DollarSign}
              label="Equivalent Upgrade"
              value={`$${wowFactors.moneySaved.amount}`}
              description={wowFactors.moneySaved.equivalent}
              color="emerald"
            />
            <WowFactorItem
              icon={TrendingUp}
              label="Your Ranking"
              value={`Top ${100 - wowFactors.percentileRank.similar}%`}
              description={`Among ${wowFactors.percentileRank.tier} builds`}
              color="cyan"
            />
            <WowFactorItem
              icon={Award}
              label="Biggest Win"
              value={wowFactors.improvementSummary.biggestGain}
              description={`${wowFactors.improvementSummary.totalOptimizations} optimizations`}
              color="purple"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
            <span className="text-sm text-white/40">Optimized with Opta</span>
          </div>
          <span className="text-sm text-white/30">opta.app</span>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';

interface DimensionCardProps {
  icon: typeof Zap;
  label: string;
  value: number;
  color: 'emerald' | 'purple' | 'cyan';
}

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    bar: 'bg-purple-500'
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    bar: 'bg-cyan-500'
  }
};

function DimensionCard({ icon: Icon, label, value, color }: DimensionCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={cn(
      'p-4 rounded-xl border',
      colors.bg,
      colors.border
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-5 h-5', colors.text)} strokeWidth={1.75} />
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('text-3xl font-bold', colors.text)}>{value}</span>
        <span className="text-sm text-white/40 mb-1">/100</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full', colors.bar)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

interface WowFactorItemProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  description: string;
  color: 'emerald' | 'purple' | 'cyan';
}

function WowFactorItem({ icon: Icon, label, value, description, color }: WowFactorItemProps) {
  const colors = colorClasses[color];

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl border',
      colors.bg,
      colors.border
    )}>
      <div className={cn(
        'w-12 h-12 rounded-lg flex items-center justify-center border',
        colors.bg,
        colors.border
      )}>
        <Icon className={cn('w-6 h-6', colors.text)} strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-white/50">{label}</p>
        <p className={cn('text-xl font-bold', colors.text)}>{value}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
    </div>
  );
}

export default ShareCard;
