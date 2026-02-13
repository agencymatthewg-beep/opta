/**
 * Recommendation Card Component
 *
 * Displays personalized optimization recommendations with
 * actions and reasoning.
 */

import { motion } from 'framer-motion';
import {
  Zap,
  Battery,
  Thermometer,
  MemoryStick,
  HardDrive,
  Gamepad2,
  Laptop,
  Lightbulb,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  Recommendation,
  RecommendationType,
  RecommendationPriority,
  RecommendationAction,
} from '@/hooks/useSmartRecommendations';

// Icon map for recommendation types
const TypeIcons: Record<RecommendationType, typeof Zap> = {
  performance: Zap,
  power_saving: Battery,
  cooling: Thermometer,
  memory: MemoryStick,
  storage: HardDrive,
  gaming: Gamepad2,
  productivity: Laptop,
};

// Priority colors
const priorityColors: Record<RecommendationPriority, string> = {
  urgent: 'border-danger/50 bg-danger/10',
  high: 'border-warning/50 bg-warning/10',
  medium: 'border-primary/50 bg-primary/10',
  low: 'border-border bg-background/50',
};

const priorityBadgeColors: Record<RecommendationPriority, string> = {
  urgent: 'bg-danger/20 text-danger',
  high: 'bg-warning/20 text-warning',
  medium: 'bg-primary/20 text-primary',
  low: 'bg-muted text-muted-foreground',
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  onDismiss?: (id: string, helpful: boolean) => void;
  onApply?: (id: string) => void;
  onAction?: (action: RecommendationAction) => void;
  compact?: boolean;
}

export function RecommendationCard({
  recommendation,
  onDismiss,
  onApply,
  onAction,
  compact = false,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const TypeIcon = TypeIcons[recommendation.type] || Lightbulb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={cn(
        'glass-subtle rounded-lg border',
        priorityColors[recommendation.priority],
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-background/50">
          <TypeIcon className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>
              {recommendation.title}
            </h4>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              priorityBadgeColors[recommendation.priority]
            )}>
              {recommendation.priority}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {recommendation.description}
          </p>

          {/* Impact */}
          <div className="flex items-center gap-2 mt-2">
            <Zap className="w-4 h-4 text-success" />
            <span className="text-sm text-success font-medium">
              {recommendation.impactEstimate}
            </span>
            <span className="text-xs text-muted-foreground">
              ({Math.round(recommendation.confidence * 100)}% confidence)
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      {!compact && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show details
              </>
            )}
          </button>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-3"
            >
              {/* Reasons */}
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">
                  Why this recommendation:
                </h5>
                <ul className="space-y-1">
                  {recommendation.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              {recommendation.actions.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">
                    Suggested actions:
                  </h5>
                  <div className="space-y-2">
                    {recommendation.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => onAction?.(action)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors text-sm"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
        {onApply && (
          <button
            onClick={() => onApply(recommendation.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply
          </button>
        )}
        {onDismiss && (
          <>
            <button
              onClick={() => onDismiss(recommendation.id, true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background/50 hover:bg-background/80 text-muted-foreground text-sm transition-colors"
            >
              Helpful
            </button>
            <button
              onClick={() => onDismiss(recommendation.id, false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background/50 hover:bg-background/80 text-muted-foreground text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Dismiss
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

interface RecommendationListProps {
  recommendations: Recommendation[];
  onDismiss?: (id: string, helpful: boolean) => void;
  onApply?: (id: string) => void;
  onAction?: (action: RecommendationAction) => void;
  maxVisible?: number;
  compact?: boolean;
}

export function RecommendationList({
  recommendations,
  onDismiss,
  onApply,
  onAction,
  maxVisible = 5,
  compact = false,
}: RecommendationListProps) {
  const visibleRecs = recommendations.slice(0, maxVisible);

  if (recommendations.length === 0) {
    return (
      <div className="glass-subtle rounded-lg p-4 text-center text-muted-foreground">
        <Lightbulb className="w-5 h-5 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recommendations right now</p>
        <p className="text-xs mt-1">Your system is running optimally</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleRecs.map(rec => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          onDismiss={onDismiss}
          onApply={onApply}
          onAction={onAction}
          compact={compact}
        />
      ))}

      {recommendations.length > maxVisible && (
        <p className="text-xs text-center text-muted-foreground">
          +{recommendations.length - maxVisible} more recommendations
        </p>
      )}
    </div>
  );
}
