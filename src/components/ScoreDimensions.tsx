import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DimensionScores, PerformanceScores, ExperienceScores, CompetitiveScores } from '@/types/scoring';
import { Zap, Eye, Target } from 'lucide-react';

interface ScoreDimensionsProps {
  dimensions: DimensionScores;
  compact?: boolean;  // For card view vs full view
}

type DimensionConfig = {
  key: string;
  label: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  scores: PerformanceScores | ExperienceScores | CompetitiveScores;
  subLabels: string[];
  subKeys: string[];
};

/**
 * ScoreDimensions - Displays the three score dimensions with sub-scores.
 * Performance, Experience, and Competitive dimensions each with breakdown bars.
 */
export function ScoreDimensions({ dimensions, compact }: ScoreDimensionsProps) {
  const dimensionConfig: DimensionConfig[] = [
    {
      key: 'performance',
      label: 'Performance',
      icon: Zap,
      color: 'text-primary',
      bgColor: 'bg-primary',
      scores: dimensions.performance,
      subLabels: ['FPS Gain', 'Stability', 'Load Times'],
      subKeys: ['fpsGain', 'stability', 'loadTimes']
    },
    {
      key: 'experience',
      label: 'Experience',
      icon: Eye,
      color: 'text-accent',
      bgColor: 'bg-accent',
      scores: dimensions.experience,
      subLabels: ['Visual Quality', 'Thermal', 'Responsiveness'],
      subKeys: ['visualQuality', 'thermalEfficiency', 'responsiveness']
    },
    {
      key: 'competitive',
      label: 'Competitive',
      icon: Target,
      color: 'text-success',
      bgColor: 'bg-success',
      scores: dimensions.competitive,
      subLabels: ['Input Lag', 'Latency', 'Interference'],
      subKeys: ['inputLag', 'networkLatency', 'interference']
    }
  ];

  return (
    <div className={cn('grid gap-4', compact ? 'grid-cols-3' : 'grid-cols-1')}>
      {dimensionConfig.map((dim, index) => (
        <motion.div
          key={dim.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass rounded-xl p-4 border border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <dim.icon className={cn('w-5 h-5', dim.color)} strokeWidth={1.75} />
            <span className="text-sm font-medium">{dim.label}</span>
            <span className={cn('ml-auto text-lg font-bold', dim.color)}>
              {Math.round(dim.scores.weighted)}
            </span>
          </div>

          {!compact && (
            <div className="space-y-2">
              {dim.subLabels.map((label, i) => {
                const subKey = dim.subKeys[i] as keyof typeof dim.scores;
                const value = dim.scores[subKey] as number;
                return (
                  <SubScoreBar
                    key={label}
                    label={label}
                    value={value}
                    bgColor={dim.bgColor}
                  />
                );
              })}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

interface SubScoreBarProps {
  label: string;
  value: number;
  bgColor: string;
}

function SubScoreBar({ label, value, bgColor }: SubScoreBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', bgColor)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default ScoreDimensions;
