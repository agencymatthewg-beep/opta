/**
 * ConflictCard component for detailed conflict display.
 *
 * Used in Settings page to show full details of each detected conflicting tool.
 * Displays tool name, description, severity badge, and recommendation.
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, ExternalLink, CheckCircle } from 'lucide-react';
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
                  <CheckCircle className="w-3 h-3 mr-1" strokeWidth={2} />
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
            <Lightbulb className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconColor)} strokeWidth={2} />
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
              <ExternalLink className="w-4 h-4 mr-1.5" strokeWidth={2} />
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
              <CheckCircle className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConflictCard;
