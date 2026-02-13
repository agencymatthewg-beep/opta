/**
 * ReviewStep - The Obsidian Review Panel
 *
 * Recommendations review with obsidian glass styling and energy impacts.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, X, Sparkles, Cpu, Monitor, Mouse } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Recommendation type for Pinpoint optimization.
 */
export interface Recommendation {
  id: string;
  name: string;
  description: string;
  impactPercent: number;
  category: 'graphics' | 'system' | 'display' | 'peripheral';
}

interface ReviewStepProps {
  recommendations: Recommendation[];
  onApprove: () => void;
  onSkip: () => void;
}

/**
 * Get icon for recommendation category.
 */
const getCategoryIcon = (category: Recommendation['category']) => {
  switch (category) {
    case 'graphics':
      return Monitor;
    case 'system':
      return Cpu;
    case 'display':
      return Monitor;
    case 'peripheral':
      return Mouse;
    default:
      return Sparkles;
  }
};

/**
 * Get category label.
 */
const getCategoryLabel = (category: Recommendation['category']) => {
  switch (category) {
    case 'graphics':
      return 'Graphics';
    case 'system':
      return 'System';
    case 'display':
      return 'Display';
    case 'peripheral':
      return 'Peripheral';
    default:
      return 'Other';
  }
};

/**
 * ReviewStep - Fourth step in the Pinpoint wizard.
 *
 * Displays recommendations with impact predictions.
 * User can approve all or skip.
 */
export function ReviewStep({ recommendations, onApprove, onSkip }: ReviewStepProps) {
  const totalImpact = recommendations.reduce((sum, r) => sum + r.impactPercent, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <h2 className="text-2xl font-bold mb-2">Review Changes</h2>
      <p className="text-muted-foreground mb-6">
        Found{' '}
        <span className="text-primary font-medium">{recommendations.length} optimizations</span>
        {' '}with estimated{' '}
        <span className="text-success font-semibold">+{totalImpact}%</span> improvement
      </p>

      {/* Recommendations list */}
      <div className="space-y-3 mb-6">
        {recommendations.map((rec, index) => {
          const Icon = getCategoryIcon(rec.category);

          return (
            <motion.div
              key={rec.id}
              className={cn(
                "rounded-xl p-4",
                // Obsidian subtle glass
                "bg-white/[0.02] border border-white/[0.04]"
              )}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.3, ease: smoothOut }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left side - info */}
                <div className="flex items-start gap-3 flex-1">
                  {/* Category icon */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      'bg-primary/10 border border-primary/20'
                    )}
                  >
                    <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>

                  <div className="min-w-0">
                    {/* Name and category */}
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground">{rec.name}</p>
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
                          'bg-muted/50 text-muted-foreground border border-border/20'
                        )}
                      >
                        {getCategoryLabel(rec.category)}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                </div>

                {/* Right side - impact badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 px-3 py-1',
                    'bg-success/10 text-success border-success/30',
                    'font-semibold'
                  )}
                >
                  +{rec.impactPercent}%
                </Badge>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Total impact summary */}
      <motion.div
        className={cn(
          "relative rounded-xl p-4 mb-6 overflow-hidden",
          // Obsidian glass with success energy
          "glass",
          "border border-success/30",
          "shadow-[inset_0_0_20px_rgba(34,197,94,0.05),0_0_15px_-5px_rgba(34,197,94,0.2)]"
        )}
        initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
        transition={{ delay: 0.4, ease: smoothOut }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Total Improvement</p>
              <p className="text-2xl font-bold text-success">+{totalImpact}%</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        className="flex gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          variant="outline"
          className="flex-1 gap-1.5 bg-white/[0.02] rounded-xl border-white/[0.06] h-12"
          onClick={onSkip}
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
          Skip All
        </Button>
        <Button
          className="flex-1 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-accent h-12"
          onClick={onApprove}
        >
          Apply All Changes
          <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default ReviewStep;
