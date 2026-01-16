/**
 * PersonalizedRecommendations - Displays personalized optimization recommendations
 * based on learned user patterns.
 *
 * Shows recommendations with confidence indicators, reasons, and expected impact.
 * Allows users to apply or dismiss recommendations.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Recommendation } from '@/types/profile';
import { Sparkles, TrendingUp, Check, X, Lightbulb, ChevronRight } from 'lucide-react';

interface PersonalizedRecommendationsProps {
  /** List of recommendations to display */
  recommendations: Recommendation[];
  /** Callback when user applies a recommendation */
  onApply: (recommendation: Recommendation) => void;
  /** Callback when user dismisses a recommendation */
  onDismiss: (recommendationId: string) => void;
  /** Whether recommendations are loading */
  loading?: boolean;
}

/**
 * Confidence badge with color coding.
 */
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: {
      bg: 'bg-success/15',
      text: 'text-success',
      border: 'border-success/30',
      label: 'High confidence',
    },
    medium: {
      bg: 'bg-warning/15',
      text: 'text-warning',
      border: 'border-warning/30',
      label: 'Medium confidence',
    },
    low: {
      bg: 'bg-muted-foreground/15',
      text: 'text-muted-foreground',
      border: 'border-muted-foreground/30',
      label: 'Suggested',
    },
  }[confidence];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
        config.bg,
        config.text,
        config.border
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Single recommendation card.
 */
function RecommendationCard({
  recommendation,
  onApply,
  onDismiss,
  index,
}: {
  recommendation: Recommendation;
  onApply: () => void;
  onDismiss: () => void;
  index: number;
}) {
  const [hovering, setHovering] = useState(false);

  // Format setting key for display
  const formatSettingKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^./, (s) => s.toUpperCase());
  };

  return (
    <motion.div
      className={cn(
        'glass-subtle rounded-lg border border-border/20 overflow-hidden',
        hovering && 'border-primary/30'
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      whileHover={{ y: -2 }}
    >
      <div className="p-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
              <Lightbulb className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-medium text-foreground truncate">
                {formatSettingKey(recommendation.settingKey)}
              </h4>
              <span className="text-[10px] text-muted-foreground/60">
                {recommendation.settingCategory}
              </span>
            </div>
          </div>
          <ConfidenceBadge confidence={recommendation.confidence} />
        </div>

        {/* Reason */}
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
          {recommendation.reason}
        </p>

        {/* Expected Impact */}
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
          <span className="text-[11px] font-medium text-success">
            {recommendation.expectedImpact}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="sm"
              onClick={onApply}
              className={cn(
                'w-full gap-1.5 rounded-lg h-7 text-xs',
                'bg-gradient-to-r from-primary to-accent',
                'hover:shadow-[0_0_12px_-4px_hsl(var(--glow-primary)/0.4)]'
              )}
            >
              <Check className="w-3 h-3" strokeWidth={2} />
              Apply
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-7 w-7 rounded-lg glass-subtle"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="sr-only">Dismiss</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Loading skeleton for recommendations.
 */
function LoadingSkeleton() {
  return (
    <div className="glass rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded bg-muted/30 animate-shimmer" />
        <div className="h-4 w-32 rounded bg-muted/30 animate-shimmer" />
      </div>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="glass-subtle rounded-lg p-3 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded bg-muted/30 animate-shimmer" />
              <div className="h-4 w-24 rounded bg-muted/30 animate-shimmer" />
              <div className="ml-auto h-4 w-16 rounded-full bg-muted/30 animate-shimmer" />
            </div>
            <div className="h-3 w-full rounded bg-muted/30 animate-shimmer mb-2" />
            <div className="h-3 w-2/3 rounded bg-muted/30 animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PersonalizedRecommendations component.
 */
export function PersonalizedRecommendations({
  recommendations,
  onApply,
  onDismiss,
  loading,
}: PersonalizedRecommendationsProps) {
  const [expanded, setExpanded] = useState(true);

  // Don't render if loading
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Don't render if no recommendations
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="glass rounded-xl border border-border/30 overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <motion.button
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3',
          'hover:bg-muted/20 transition-colors',
          'border-b border-border/20'
        )}
        onClick={() => setExpanded(!expanded)}
        whileHover={{ backgroundColor: 'hsl(var(--muted) / 0.2)' }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="p-1.5 rounded-lg bg-primary/10"
            animate={{ rotate: expanded ? 0 : -10 }}
          >
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </motion.div>
          <h3 className="text-sm font-medium text-foreground">
            Recommended for You
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
            {recommendations.length}
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
        </motion.div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {recommendations.map((rec, index) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onApply={() => onApply(rec)}
                    onDismiss={() => onDismiss(rec.id)}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default PersonalizedRecommendations;
