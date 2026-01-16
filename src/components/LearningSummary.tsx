/**
 * LearningSummary - Monthly summary of what Opta has learned about user preferences.
 *
 * Displays learned preferences, aversions, and statistics in a visual format,
 * helping users understand how Opta adapts to their behavior.
 */

import { motion } from 'framer-motion';
import { useLearning } from '../hooks/useLearning';
import { cn } from '@/lib/utils';
import { Brain, ThumbsUp, ThumbsDown, TrendingUp, BarChart3, Calendar } from 'lucide-react';

export interface LearningSummaryProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format timestamp to relative date string.
 */
function formatRelativeDate(timestamp: number | null): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Empty state when no learning has occurred yet.
 */
function EmptyLearningState() {
  return (
    <motion.div
      className="py-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className={cn(
          'w-14 h-14 mx-auto flex items-center justify-center rounded-full mb-4',
          'glass border border-border/30'
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Brain className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
      </motion.div>
      <h4 className="text-sm font-medium text-foreground mb-2">
        No Patterns Learned Yet
      </h4>
      <p className="text-xs text-muted-foreground/60 max-w-[280px] mx-auto">
        Opta will learn your preferences as you use the app. Your patterns will appear here.
      </p>
    </motion.div>
  );
}

/**
 * LearningSummary component.
 * Shows a summary of what Opta has learned this month.
 */
export function LearningSummary({ className }: LearningSummaryProps) {
  const { learnedPreferences, learningStats, loading } = useLearning();

  if (loading) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 rounded bg-muted/30 animate-shimmer" />
          <div className="h-4 w-48 rounded bg-muted/30 animate-shimmer" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-subtle rounded-lg p-4 animate-pulse border border-border/20">
              <div className="h-4 bg-muted/20 rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted/20 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state if no patterns
  if (learnedPreferences.length === 0) {
    return (
      <div className={cn('glass rounded-xl p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary" strokeWidth={1.75} />
          <h3 className="font-semibold">What Opta Learned This Month</h3>
        </div>
        <EmptyLearningState />
      </div>
    );
  }

  return (
    <motion.div
      className={cn('glass rounded-xl p-6', className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          'bg-primary/15 border border-primary/30'
        )}>
          <Brain className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </div>
        <h3 className="font-semibold">What Opta Learned This Month</h3>
      </div>

      {/* Preferences List */}
      <div className="space-y-3">
        {learnedPreferences.slice(0, 5).map((pref, i) => (
          <motion.div
            key={pref.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              'glass-subtle rounded-lg p-3 border border-border/20',
              'flex items-center justify-between gap-3'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                pref.isPositive
                  ? 'bg-success/15 border border-success/30'
                  : 'bg-warning/15 border border-warning/30'
              )}>
                {pref.isPositive ? (
                  <ThumbsUp className="w-4 h-4 text-success" strokeWidth={1.75} />
                ) : (
                  <ThumbsDown className="w-4 h-4 text-warning" strokeWidth={1.75} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {pref.description}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {pref.sampleCount} {pref.sampleCount === 1 ? 'decision' : 'decisions'} analyzed
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                pref.confidence >= 80
                  ? 'bg-success/15 text-success border border-success/30'
                  : pref.confidence >= 50
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-muted/30 text-muted-foreground border border-border/30'
              )}>
                {pref.confidence}% confident
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Show more indicator if there are more preferences */}
      {learnedPreferences.length > 5 && (
        <p className="text-xs text-muted-foreground/50 text-center mt-3">
          +{learnedPreferences.length - 5} more patterns learned
        </p>
      )}

      {/* Statistics Footer */}
      <motion.div
        className="mt-4 pt-4 border-t border-border/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              <span className="text-lg font-bold text-foreground tabular-nums">
                {learningStats.totalDecisions}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              Decisions
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-success" strokeWidth={1.75} />
              <span className="text-lg font-bold text-foreground tabular-nums">
                {learningStats.totalPatterns}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              Patterns
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-xs font-medium text-foreground">
                {formatRelativeDate(learningStats.lastUpdated)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              Last Updated
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LearningSummary;
