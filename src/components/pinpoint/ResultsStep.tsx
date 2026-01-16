/**
 * ResultsStep - The Obsidian Success Screen
 *
 * Final step with obsidian glass styling and energy celebration effects.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OptimizationGoal } from './GoalSelector';
import type { Recommendation } from './ReviewStep';
import type { DetectedGame } from '../../types/games';
import { CheckCircle2, Sparkles, RotateCcw, Play, TrendingUp } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ResultsStepProps {
  game: DetectedGame;
  goal: OptimizationGoal;
  recommendations: Recommendation[];
  onStartNew: () => void;
}

/**
 * ResultsStep - Final step in the Pinpoint wizard.
 *
 * Shows success message with summary of applied optimizations.
 * Offers options to start a new session or launch the game.
 */
export function ResultsStep({ game, goal, recommendations, onStartNew }: ResultsStepProps) {
  const totalImpact = recommendations.reduce((sum, r) => sum + r.impactPercent, 0);

  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success icon */}
      <motion.div
        className={cn(
          "w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center",
          // Obsidian glass with success energy
          "bg-[#05030a]/80 backdrop-blur-xl",
          "border border-success/30",
          "shadow-[0_0_30px_-8px_rgba(34,197,94,0.4)]"
        )}
        initial={{ scale: 0.8, opacity: 0, filter: 'brightness(0.5)' }}
        animate={{ scale: 1, opacity: 1, filter: 'brightness(1)' }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
        >
          <CheckCircle2 className="w-12 h-12 text-success" strokeWidth={1.5} />
        </motion.div>
      </motion.div>

      {/* Success message */}
      <motion.h2
        className="text-2xl font-bold mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Optimization Complete!
      </motion.h2>

      <motion.p
        className="text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-foreground font-medium">{game.name}</span> has been optimized for{' '}
        <span className="text-primary font-medium">{goal.label}</span>
      </motion.p>

      {/* Results summary */}
      <motion.div
        className={cn(
          "relative rounded-xl p-6 mb-6 text-left overflow-hidden",
          // Obsidian glass material
          "bg-[#05030a]/80 backdrop-blur-xl",
          "border border-white/[0.06]",
          // Inner specular highlight
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
          "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
        )}
        initial={{ opacity: 0, y: 20, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
        transition={{ delay: 0.4, ease: smoothOut }}
      >
        {/* Impact header */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/[0.05]">
          <div className="w-14 h-14 rounded-xl bg-success/15 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-success" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estimated Improvement</p>
            <p className="text-3xl font-bold text-success">+{totalImpact}%</p>
          </div>
        </div>

        {/* Applied optimizations summary */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
            <h3 className="text-sm font-medium text-foreground">Applied Optimizations</h3>
          </div>

          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <motion.div
                key={rec.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.05, ease: smoothOut }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" strokeWidth={2} />
                  <span className="text-sm text-foreground">{rec.name}</span>
                </div>
                <span className="text-sm font-medium text-success">+{rec.impactPercent}%</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="flex gap-2 flex-wrap">
          {Array.from(new Set(recommendations.map((r) => r.category))).map((category) => (
            <span
              key={category}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                'bg-primary/15 text-primary border border-primary/30'
              )}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        className="flex gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          variant="outline"
          className="flex-1 gap-1.5 bg-white/[0.02] rounded-xl border-white/[0.06] h-12"
          onClick={onStartNew}
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          New Session
        </Button>
        <Button
          className="flex-1 gap-1.5 rounded-xl bg-gradient-to-r from-success to-accent h-12"
        >
          <Play className="w-4 h-4" strokeWidth={1.75} />
          Launch {game.name.length > 15 ? 'Game' : game.name}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default ResultsStep;
