/**
 * OptimizationFeedback - "This didn't work" feedback button.
 *
 * Allows users to provide negative feedback on optimizations
 * that didn't work for them. Records feedback for learning.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Framer Motion animations
 * - Lucide icons
 * - Semantic colors
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThumbsDown, ThumbsUp, CheckCircle, Sparkles } from 'lucide-react';
import type { AppliedOptimization } from '../hooks/useRollback';

/**
 * Feedback record for an optimization.
 */
export interface OptimizationFeedbackRecord {
  /** Optimization ID */
  optimizationId: string;
  /** Type of feedback */
  type: 'positive' | 'negative';
  /** Context about when feedback was given */
  context: {
    /** Game ID if applicable */
    gameId?: string;
    /** Game name if applicable */
    gameName?: string;
    /** Setting category */
    settingCategory?: string;
    /** Timestamp */
    timestamp: number;
  };
}

export interface OptimizationFeedbackProps {
  /** The optimization this feedback is for */
  optimization: AppliedOptimization;
  /** Game ID */
  gameId?: string;
  /** Game name */
  gameName?: string;
  /** Callback when feedback is submitted */
  onFeedback?: (feedback: OptimizationFeedbackRecord) => void;
  /** Show both positive and negative options */
  showPositive?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

const FEEDBACK_STORAGE_KEY = 'opta-optimization-feedback';

/**
 * Record feedback to localStorage for future learning.
 */
function recordFeedback(feedback: OptimizationFeedbackRecord): void {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    const records: OptimizationFeedbackRecord[] = stored
      ? JSON.parse(stored)
      : [];

    // Add new feedback
    records.push(feedback);

    // Keep last 100 feedback records
    const trimmed = records.slice(-100);

    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail if localStorage unavailable
  }
}

/**
 * Get all recorded feedback.
 */
export function getRecordedFeedback(): OptimizationFeedbackRecord[] {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function OptimizationFeedback({
  optimization,
  gameId,
  gameName,
  onFeedback,
  showPositive = false,
  size = 'sm',
  className,
}: OptimizationFeedbackProps) {
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = useCallback(
    (type: 'positive' | 'negative') => {
      const feedback: OptimizationFeedbackRecord = {
        optimizationId: optimization.id,
        type,
        context: {
          gameId,
          gameName,
          settingCategory: optimization.category,
          timestamp: Date.now(),
        },
      };

      recordFeedback(feedback);
      setSubmitted(type);
      onFeedback?.(feedback);
    },
    [optimization, gameId, gameName, onFeedback]
  );

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  // Success state after feedback
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'flex items-center gap-1.5',
          textSize,
          'text-muted-foreground/70',
          className
        )}
      >
        <CheckCircle className={cn(iconSize, 'text-success')} strokeWidth={2} />
        <span>Thanks! Opta will learn from this.</span>
      </motion.div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Negative feedback button (primary) */}
      <motion.button
        onClick={() => handleFeedback('negative')}
        className={cn(
          'flex items-center gap-1.5',
          textSize,
          'text-muted-foreground/60 hover:text-foreground transition-colors',
          'group'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ThumbsDown
          className={cn(
            iconSize,
            'group-hover:text-danger transition-colors'
          )}
          strokeWidth={1.75}
        />
        <span className="group-hover:text-foreground/80">
          This didn't work for me
        </span>
      </motion.button>

      {/* Positive feedback button (optional) */}
      {showPositive && (
        <motion.button
          onClick={() => handleFeedback('positive')}
          className={cn(
            'flex items-center gap-1.5',
            textSize,
            'text-muted-foreground/60 hover:text-foreground transition-colors',
            'group'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ThumbsUp
            className={cn(
              iconSize,
              'group-hover:text-success transition-colors'
            )}
            strokeWidth={1.75}
          />
          <span className="group-hover:text-foreground/80">This worked</span>
        </motion.button>
      )}
    </div>
  );
}

/**
 * Inline feedback for result modal - simpler version.
 */
export function OptimizationFeedbackInline({
  optimizationId,
  gameId,
  gameName,
  settingCategory,
  onFeedback,
  className,
}: {
  optimizationId: string;
  gameId?: string;
  gameName?: string;
  settingCategory?: string;
  onFeedback?: (type: 'positive' | 'negative') => void;
  className?: string;
}) {
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = useCallback(
    (type: 'positive' | 'negative') => {
      const feedback: OptimizationFeedbackRecord = {
        optimizationId,
        type,
        context: {
          gameId,
          gameName,
          settingCategory,
          timestamp: Date.now(),
        },
      };

      recordFeedback(feedback);
      setSubmitted(type);
      onFeedback?.(type);
    },
    [optimizationId, gameId, gameName, settingCategory, onFeedback]
  );

  if (submitted) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground/70',
            className
          )}
        >
          <Sparkles className="w-3 h-3 text-primary" strokeWidth={1.75} />
          <span>Thanks! Opta will improve.</span>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <motion.button
        onClick={() => handleFeedback('positive')}
        className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-success transition-colors group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="This worked well"
      >
        <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.75} />
      </motion.button>
      <motion.button
        onClick={() => handleFeedback('negative')}
        className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-danger transition-colors group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="This didn't work"
      >
        <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.75} />
      </motion.button>
    </div>
  );
}

export default OptimizationFeedback;
