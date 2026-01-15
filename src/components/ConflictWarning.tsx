/**
 * ConflictWarning banner component.
 *
 * Displays a collapsible banner at the top of the Dashboard when conflicting
 * optimization tools are detected. Shows severity-based styling with glow effects.
 */

import { useState } from 'react';
import { useConflicts } from '../hooks/useConflicts';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConflictSeverity } from '../types/conflicts';

/**
 * Get variant and styling based on highest severity.
 */
function getSeverityConfig(severity: ConflictSeverity) {
  switch (severity) {
    case 'high':
      return {
        variant: 'destructive' as const,
        glowClass: 'glow-sm-danger',
        iconColor: 'text-danger',
        bgColor: 'bg-danger/5',
        borderColor: 'border-danger/30',
      };
    case 'medium':
      return {
        variant: 'warning' as const,
        glowClass: 'glow-sm-warning',
        iconColor: 'text-warning',
        bgColor: 'bg-warning/5',
        borderColor: 'border-warning/30',
      };
    case 'low':
    default:
      return {
        variant: 'info' as const,
        glowClass: 'glow-sm',
        iconColor: 'text-primary',
        bgColor: 'bg-primary/5',
        borderColor: 'border-primary/30',
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
 * Warning triangle icon for high/medium severity.
 */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * Info circle icon for low severity.
 */
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Chevron icon for expand/collapse.
 */
function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * X icon for dismiss button.
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('w-4 h-4', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface ConflictWarningProps {
  /** Callback when "View Details" is clicked to navigate to Settings */
  onViewDetails?: () => void;
}

/**
 * ConflictWarning component displays a collapsible banner when conflicts are detected.
 *
 * Features:
 * - Color-coded by highest severity (high: red, medium: amber, low: blue)
 * - Expandable to show conflict details
 * - Per-session dismissible
 * - "View Details" link to Settings page
 *
 * Returns null if no conflicts detected.
 */
function ConflictWarning({ onViewDetails }: ConflictWarningProps) {
  const { conflicts, summary, loading } = useConflicts();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't render during loading, when dismissed, or when no conflicts
  if (loading || dismissed || conflicts.length === 0 || !summary) {
    return null;
  }

  const highestSeverity = getHighestSeverity(summary.high_count, summary.medium_count);
  const config = getSeverityConfig(highestSeverity);
  const Icon = highestSeverity === 'low' ? InfoIcon : WarningIcon;

  return (
    <Alert
      variant={config.variant}
      className={cn(
        'mb-6 transition-all duration-300',
        config.glowClass,
        config.bgColor,
        config.borderColor,
        'relative overflow-hidden'
      )}
    >
      {/* Main content row */}
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 flex-shrink-0', config.iconColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTitle className="text-foreground">
              {summary.total_count} conflict{summary.total_count !== 1 ? 's' : ''} detected
            </AlertTitle>

            {/* Severity badges */}
            <div className="flex gap-1.5">
              {summary.high_count > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {summary.high_count} high
                </Badge>
              )}
              {summary.medium_count > 0 && (
                <Badge variant="warning" className="text-xs">
                  {summary.medium_count} medium
                </Badge>
              )}
              {summary.low_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {summary.low_count} low
                </Badge>
              )}
            </div>
          </div>

          <AlertDescription className="mt-1 text-muted-foreground">
            Other optimization tools may interfere with Opta's performance.
          </AlertDescription>

          {/* Expanded details */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-300',
              expanded ? 'max-h-96 mt-3 opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="space-y-2 pt-2 border-t border-border/50">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.tool_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Badge
                    variant={
                      conflict.severity === 'high'
                        ? 'destructive'
                        : conflict.severity === 'medium'
                        ? 'warning'
                        : 'secondary'
                    }
                    className="text-xs min-w-[52px] justify-center"
                  >
                    {conflict.severity}
                  </Badge>
                  <span className="font-medium text-foreground">{conflict.name}</span>
                  <span className="text-muted-foreground truncate">
                    - {conflict.description}
                  </span>
                </div>
              ))}
            </div>

            {onViewDetails && (
              <Button
                variant="link"
                className="mt-2 p-0 h-auto text-primary"
                onClick={onViewDetails}
              >
                View Details in Settings
              </Button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon expanded={expanded} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </Alert>
  );
}

export default ConflictWarning;
