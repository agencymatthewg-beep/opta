import { useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScoreDimensions } from './ScoreDimensions';
import { WowFactorsDisplay } from './WowFactorsDisplay';
import type { OptaScore } from '@/types/scoring';
import { Award, Share2, Download } from 'lucide-react';

interface OptaScoreCardProps {
  score: OptaScore;
  onShare?: () => void;
  onExport?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * OptaScoreCard - Main shareable score card component.
 * Combines overall score, dimensions, and wow factors into a shareable format.
 */
export function OptaScoreCard({
  score,
  onShare,
  onExport,
  showActions = true,
  compact = false
}: OptaScoreCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'glass-strong rounded-2xl border border-border/30 overflow-hidden',
        compact ? 'max-w-sm' : 'max-w-2xl'
      )}
    >
      {/* Header with overall score */}
      <div className="relative p-6 text-center border-b border-border/20">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

        <div className="relative">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full glass border-2 border-primary/50 mb-4"
          >
            <span className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {score.overall}
            </span>
          </motion.div>

          <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Opta Score
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            {score.hardwareTier.signature}
          </p>
        </div>
      </div>

      {/* Dimensions */}
      <div className="p-4">
        <ScoreDimensions dimensions={score.dimensions} compact={compact} />
      </div>

      {/* Wow Factors (not in compact mode) */}
      {!compact && (
        <div className="px-4 pb-4">
          <WowFactorsDisplay wowFactors={score.wowFactors} animate />
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 p-4 border-t border-border/20">
          <Button
            variant="outline"
            className="flex-1 gap-2 glass-subtle rounded-xl border-border/30"
            onClick={onShare}
          >
            <Share2 className="w-4 h-4" strokeWidth={1.75} />
            Share
          </Button>
          <Button
            className="flex-1 gap-2 rounded-xl bg-gradient-to-r from-primary to-accent"
            onClick={onExport}
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            Export Card
          </Button>
        </div>
      )}

      {/* Opta branding */}
      <div className="flex items-center justify-center gap-2 py-3 bg-card/40">
        <Award className="w-4 h-4 text-primary" strokeWidth={1.75} />
        <span className="text-xs text-muted-foreground">Powered by Opta</span>
      </div>
    </motion.div>
  );
}

export default OptaScoreCard;
