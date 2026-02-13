/**
 * Anomaly Alert Component
 *
 * Displays detected anomalies with appropriate severity styling
 * and actionable suggestions.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Anomaly, AnomalySeverity } from '@/hooks/useAnomalyDetection';

interface AnomalyAlertProps {
  anomaly: Anomaly;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export function AnomalyAlert({
  anomaly,
  onDismiss,
  compact = false,
}: AnomalyAlertProps) {
  // Get severity icon
  const SeverityIcon = anomaly.severity === 'critical'
    ? AlertTriangle
    : anomaly.severity === 'warning'
      ? AlertCircle
      : Info;

  // Get severity colors
  const severityColors: Record<AnomalySeverity, string> = {
    critical: 'border-danger/50 bg-danger/10',
    warning: 'border-warning/50 bg-warning/10',
    info: 'border-primary/50 bg-primary/10',
  };

  const iconColors: Record<AnomalySeverity, string> = {
    critical: 'text-danger',
    warning: 'text-warning',
    info: 'text-primary',
  };

  // Format timestamp
  const timeAgo = () => {
    const seconds = Math.floor((Date.now() - anomaly.timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'glass-subtle rounded-lg border',
        severityColors[anomaly.severity],
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('mt-0.5', iconColors[anomaly.severity])}>
          <SeverityIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn(
              'font-medium',
              compact ? 'text-sm' : 'text-base'
            )}>
              {anomaly.message}
            </h4>
            {onDismiss && (
              <button
                onClick={() => onDismiss(anomaly.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Details */}
          {!compact && (
            <>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>
                  Current: <span className="text-foreground">{anomaly.currentValue.toFixed(1)}%</span>
                </span>
                <span>
                  Expected: <span className="text-foreground">{anomaly.expectedValue.toFixed(1)}%</span>
                </span>
              </div>

              {/* Suggestion */}
              <div className="flex items-start gap-2 mt-3 p-2 rounded bg-background/50">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {anomaly.suggestion}
                </p>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo()}</span>
            </div>
            {anomaly.autoDismissSeconds && (
              <span className="text-muted-foreground/60">
                Auto-dismisses in {anomaly.autoDismissSeconds}s
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface AnomalyListProps {
  anomalies: Anomaly[];
  onDismiss?: (id: string) => void;
  maxVisible?: number;
  compact?: boolean;
}

export function AnomalyList({
  anomalies,
  onDismiss,
  maxVisible = 5,
  compact = false,
}: AnomalyListProps) {
  // Sort by severity (critical first) then by timestamp (newest first)
  const sortedAnomalies = [...anomalies]
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxVisible);

  if (anomalies.length === 0) {
    return (
      <div className="glass-subtle rounded-lg p-4 text-center text-muted-foreground">
        <Info className="w-5 h-5 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No anomalies detected</p>
        <p className="text-xs mt-1">System is operating normally</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {sortedAnomalies.map(anomaly => (
          <AnomalyAlert
            key={anomaly.id}
            anomaly={anomaly}
            onDismiss={onDismiss}
            compact={compact}
          />
        ))}
      </AnimatePresence>

      {anomalies.length > maxVisible && (
        <p className="text-xs text-center text-muted-foreground">
          +{anomalies.length - maxVisible} more anomalies
        </p>
      )}
    </div>
  );
}
