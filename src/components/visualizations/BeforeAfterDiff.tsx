/**
 * BeforeAfterDiff - Visual diff component for settings changes.
 *
 * Shows a list of optimization changes with impact indicators,
 * before/after values, and quality impact badges.
 * Only renders when Learn Mode is active.
 */

import { motion } from 'framer-motion';

import { useLearnMode } from '@/components/LearnModeContext';
import { cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SettingChange {
  name: string;
  before: string;
  after: string;
  impact: 'positive' | 'negative' | 'neutral';
  fpsGain?: number;
  qualityLoss?: 'none' | 'minor' | 'moderate' | 'significant';
}

interface BeforeAfterDiffProps {
  changes: SettingChange[];
  totalFpsGain: number;
}

export function BeforeAfterDiff({ changes, totalFpsGain }: BeforeAfterDiffProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl p-4 my-4 bg-white/[0.02] border border-white/[0.04]"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">What Changed</h4>
        <div className="text-sm font-medium text-success">
          +{totalFpsGain} FPS expected
        </div>
      </div>

      <div className="space-y-2">
        {changes.map((change, i) => (
          <motion.div
            key={change.name}
            className="flex items-center gap-2 p-2 rounded-lg bg-card/50"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {/* Impact indicator */}
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
              change.impact === 'positive' && "bg-success/20 text-success",
              change.impact === 'negative' && "bg-danger/20 text-danger",
              change.impact === 'neutral' && "bg-muted text-muted-foreground"
            )}>
              {change.impact === 'positive' && <TrendingUp className="w-3 h-3" strokeWidth={2} />}
              {change.impact === 'negative' && <TrendingDown className="w-3 h-3" strokeWidth={2} />}
              {change.impact === 'neutral' && <Minus className="w-3 h-3" strokeWidth={2} />}
            </div>

            {/* Setting name */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{change.name}</div>
              {change.fpsGain && change.fpsGain > 0 && (
                <div className="text-xs text-success">+{change.fpsGain} FPS</div>
              )}
            </div>

            {/* Before/After values */}
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <span className="text-muted-foreground line-through">{change.before}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" strokeWidth={2} />
              <span className="text-primary font-medium">{change.after}</span>
            </div>

            {/* Quality impact */}
            {change.qualityLoss && change.qualityLoss !== 'none' && (
              <div className={cn(
                "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                change.qualityLoss === 'minor' && "bg-success/20 text-success",
                change.qualityLoss === 'moderate' && "bg-warning/20 text-warning",
                change.qualityLoss === 'significant' && "bg-danger/20 text-danger"
              )}>
                {change.qualityLoss}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Green arrows indicate performance gains. Each change shows expected FPS
        improvement and any visual quality trade-off.
      </p>
    </motion.div>
  );
}
