/**
 * ConflictWarning - The Obsidian Conflict Banner
 *
 * Displays a collapsible banner at the top of the Dashboard when conflicting
 * optimization tools are detected. Shows severity-based styling with energy glows.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConflicts } from '../hooks/useConflicts';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { ConflictSeverity } from '../types/conflicts';
import { AlertTriangle, Info, ChevronDown, X, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * Get variant and styling based on highest severity.
 */
function getSeverityConfig(severity: ConflictSeverity) {
  switch (severity) {
    case 'high':
      return {
        glowClass: 'shadow-[0_0_24px_-8px_hsl(var(--danger)/0.4)]',
        iconColor: 'text-danger',
        bgColor: 'from-danger/10 via-danger/5 to-transparent',
        borderColor: 'border-danger/40',
        badgeClass: 'bg-danger/15 text-danger border-danger/30',
      };
    case 'medium':
      return {
        glowClass: 'shadow-[0_0_24px_-8px_hsl(var(--warning)/0.4)]',
        iconColor: 'text-warning',
        bgColor: 'from-warning/10 via-warning/5 to-transparent',
        borderColor: 'border-warning/40',
        badgeClass: 'bg-warning/15 text-warning border-warning/30',
      };
    case 'low':
    default:
      return {
        glowClass: 'shadow-[0_0_24px_-8px_hsl(var(--primary)/0.3)]',
        iconColor: 'text-primary',
        bgColor: 'from-primary/10 via-primary/5 to-transparent',
        borderColor: 'border-primary/40',
        badgeClass: 'bg-primary/15 text-primary border-primary/30',
      };
  }
}

/**
 * Get the highest severity from conflict counts.
 */
function getHighestSeverity(highCount: number, mediumCount: number): ConflictSeverity {
  if (highCount > 0) return 'high';
  if (mediumCount > 0) return 'medium';
  return 'low';
}

/**
 * Severity badge component.
 */
function SeverityBadge({ count, severity }: { count: number; severity: ConflictSeverity }) {
  const colors: Record<ConflictSeverity, string> = {
    high: 'bg-danger/15 text-danger border-danger/30',
    medium: 'bg-warning/15 text-warning border-warning/30',
    low: 'bg-muted/50 text-muted-foreground border-border/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
      colors[severity]
    )}>
      {count} {severity}
    </span>
  );
}

interface ConflictWarningProps {
  /** Callback when "View Details" is clicked to navigate to Settings */
  onViewDetails?: () => void;
}

/**
 * ConflictWarning component displays a collapsible banner when conflicts are detected.
 */
function ConflictWarning({ onViewDetails }: ConflictWarningProps) {
  const { conflicts, summary, loading, error, refresh } = useConflicts();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Handle retry with loading state
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  // Show error state if conflict detection failed
  if (error && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Alert variant="warning" className="bg-white/[0.02] border-white/[0.04]">
          <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
          <AlertDescription className="flex items-center justify-between">
            <span>Could not check for conflicting tools.</span>
            <Button
              variant="link"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
              className="p-0 h-auto text-warning gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', retrying && 'animate-spin')} strokeWidth={2} />
              {retrying ? 'Retrying...' : 'Retry'}
            </Button>
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  // Don't render during loading, when dismissed, or when no conflicts
  if (loading || dismissed || conflicts.length === 0 || !summary) {
    return null;
  }

  const highestSeverity = getHighestSeverity(summary.high_count, summary.medium_count);
  const config = getSeverityConfig(highestSeverity);
  const Icon = highestSeverity === 'low' ? Info : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      className={cn(
        'relative mb-6 rounded-xl overflow-hidden',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl border',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        config.borderColor,
        config.glowClass
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-r',
        config.bgColor
      )} />

      {/* Main content row */}
      <div className="relative flex items-start gap-4 p-4">
        <motion.div
          className={cn('mt-0.5 flex-shrink-0', config.iconColor)}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">
              {summary.total_count} conflict{summary.total_count !== 1 ? 's' : ''} detected
            </h4>

            {/* Severity badges */}
            <div className="flex gap-1.5">
              {summary.high_count > 0 && (
                <SeverityBadge count={summary.high_count} severity="high" />
              )}
              {summary.medium_count > 0 && (
                <SeverityBadge count={summary.medium_count} severity="medium" />
              )}
              {summary.low_count > 0 && (
                <SeverityBadge count={summary.low_count} severity="low" />
              )}
            </div>
          </div>

          <p className="mt-1 text-sm text-muted-foreground/70">
            Other optimization tools may interfere with Opta's performance.
          </p>

          {/* Expanded details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-3 mt-3 border-t border-border/30">
                  {conflicts.map((conflict, index) => (
                    <motion.div
                      key={conflict.tool_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border min-w-[52px] justify-center',
                        conflict.severity === 'high'
                          ? 'bg-danger/15 text-danger border-danger/30'
                          : conflict.severity === 'medium'
                          ? 'bg-warning/15 text-warning border-warning/30'
                          : 'bg-muted/50 text-muted-foreground border-border/30'
                      )}>
                        {conflict.severity}
                      </span>
                      <span className="font-medium text-foreground">{conflict.name}</span>
                      <span className="text-muted-foreground/60 truncate">
                        - {conflict.description}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {onViewDetails && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Button
                      variant="link"
                      className="mt-3 p-0 h-auto text-primary gap-1.5"
                      onClick={onViewDetails}
                    >
                      View Details in Settings
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground bg-white/[0.02] border border-white/[0.04] rounded-lg"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" strokeWidth={2} />
              </motion.div>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground bg-white/[0.02] border border-white/[0.04] rounded-lg"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default ConflictWarning;
