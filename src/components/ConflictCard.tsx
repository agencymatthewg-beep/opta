/**
 * ConflictCard component for detailed conflict display.
 *
 * Used in Settings page to show full details of each detected conflicting tool.
 * Displays tool name, description, severity badge, and recommendation.
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ConflictInfo, ConflictSeverity } from '../types/conflicts';

/**
 * Get styling configuration based on severity level.
 */
function getSeverityConfig(severity: ConflictSeverity) {
  switch (severity) {
    case 'high':
      return {
        badgeVariant: 'destructive' as const,
        borderClass: 'border-danger/30',
        accentBg: 'bg-danger/10',
        iconColor: 'text-danger',
      };
    case 'medium':
      return {
        badgeVariant: 'warning' as const,
        borderClass: 'border-warning/30',
        accentBg: 'bg-warning/10',
        iconColor: 'text-warning',
      };
    case 'low':
    default:
      return {
        badgeVariant: 'secondary' as const,
        borderClass: 'border-border',
        accentBg: 'bg-muted/50',
        iconColor: 'text-muted-foreground',
      };
  }
}

/**
 * Lightbulb icon for recommendations.
 */
function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

/**
 * External link icon.
 */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

/**
 * Check circle icon for acknowledged state.
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

interface ConflictCardProps {
  /** The conflict information to display */
  conflict: ConflictInfo;
  /** Whether this conflict has been acknowledged/dismissed */
  acknowledged?: boolean;
  /** Callback when user clicks "Dismiss" (mark as acknowledged) */
  onDismiss?: (toolId: string) => void;
  /** Callback when user clicks "Learn More" (placeholder for docs) */
  onLearnMore?: (toolId: string) => void;
}

/**
 * ConflictCard displays detailed information about a single conflicting tool.
 *
 * Features:
 * - Tool name and description
 * - Severity badge (high/medium/low)
 * - Highlighted recommendation box
 * - Detected process names
 * - Learn More link (future: links to docs)
 * - Dismiss button (marks as acknowledged)
 */
function ConflictCard({
  conflict,
  acknowledged = false,
  onDismiss,
  onLearnMore,
}: ConflictCardProps) {
  const config = getSeverityConfig(conflict.severity);

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        config.borderClass,
        acknowledged && 'opacity-60'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold">
                {conflict.name}
              </CardTitle>
              <Badge variant={config.badgeVariant} className="text-xs">
                {conflict.severity} severity
              </Badge>
              {acknowledged && (
                <Badge variant="outline" className="text-xs text-success border-success/50">
                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                  Acknowledged
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1.5">
              {conflict.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recommendation box */}
        <div className={cn('rounded-lg p-3 border', config.accentBg, config.borderClass)}>
          <div className="flex items-start gap-2">
            <LightbulbIcon className={cn('mt-0.5 flex-shrink-0', config.iconColor)} />
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recommendation
              </span>
              <p className="text-sm text-foreground mt-0.5">{conflict.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Detected processes */}
        {conflict.detected_processes.length > 0 && (
          <div className="text-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Detected Processes
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {conflict.detected_processes.map((process, index) => (
                <code
                  key={index}
                  className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                >
                  {process}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {onLearnMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-primary"
              onClick={() => onLearnMore(conflict.tool_id)}
            >
              <ExternalLinkIcon className="w-4 h-4 mr-1.5" />
              Learn More
            </Button>
          )}
          {onDismiss && !acknowledged && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-success"
              onClick={() => onDismiss(conflict.tool_id)}
            >
              <CheckCircleIcon className="w-4 h-4 mr-1.5" />
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConflictCard;
