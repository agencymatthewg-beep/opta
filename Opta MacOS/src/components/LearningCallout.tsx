/**
 * LearningCallout - Inline callout showing when Opta uses learned preferences.
 *
 * Displays contextual information about applied preferences during optimization,
 * with options to dismiss or change the preference.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, X, Settings } from 'lucide-react';

export interface LearningCalloutProps {
  /** The preference being applied */
  preference: string;
  /** Description of the action taken */
  action: string;
  /** Callback when user dismisses the callout */
  onDismiss?: () => void;
  /** Callback when user wants to change the preference */
  onChangePreference?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the callout is visible */
  visible?: boolean;
}

/**
 * LearningCallout component.
 * Shows inline callouts when Opta uses learned preferences.
 */
export function LearningCallout({
  preference,
  action,
  onDismiss,
  onChangePreference,
  className,
  visible = true,
}: LearningCalloutProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'rounded-lg p-3 bg-white/[0.02] flex items-start gap-3',
            'border border-primary/20',
            className
          )}
        >
          {/* Brain icon */}
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            'bg-primary/15 border border-primary/30'
          )}>
            <Brain className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="text-primary font-medium">Based on your history:</span>{' '}
              <span className="text-foreground">{action}</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 truncate">
              {preference}
            </p>

            {/* Actions */}
            {(onChangePreference || onDismiss) && (
              <div className="flex items-center gap-3 mt-2">
                {onChangePreference && (
                  <motion.button
                    onClick={onChangePreference}
                    className={cn(
                      'inline-flex items-center gap-1 text-xs text-primary',
                      'hover:underline focus:outline-none focus:underline'
                    )}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Settings className="w-3 h-3" strokeWidth={1.75} />
                    Change this preference
                  </motion.button>
                )}
                {onDismiss && (
                  <motion.button
                    onClick={onDismiss}
                    className={cn(
                      'inline-flex items-center gap-1 text-xs text-muted-foreground/60',
                      'hover:text-muted-foreground hover:underline',
                      'focus:outline-none focus:underline'
                    )}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <X className="w-3 h-3" strokeWidth={1.75} />
                    Don't show again
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LearningCallout;
