import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { Recommendation } from './ReviewStep';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface ApplyStepProps {
  recommendations: Recommendation[];
  onComplete: () => void;
}

/**
 * Delay utility for simulating application progress.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ApplyStep - Fifth step in the Pinpoint wizard.
 *
 * Shows progress as each recommendation is applied.
 * Simulates applying optimizations one by one.
 */
export function ApplyStep({ recommendations, onComplete }: ApplyStepProps) {
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const applyOptimizations = async () => {
      const total = recommendations.length;

      for (let i = 0; i < total; i++) {
        const rec = recommendations[i];
        setCurrentIndex(i);

        // Simulate applying this recommendation
        const startProgress = (i / total) * 100;
        const endProgress = ((i + 1) / total) * 100;

        for (let p = startProgress; p <= endProgress; p += 5) {
          await delay(80);
          setProgress(Math.min(p, 100));
        }

        // Mark as complete
        setCompletedIds((prev) => new Set([...prev, rec.id]));
        await delay(200);
      }

      // Final delay before completing
      await delay(500);
      onComplete();
    };

    applyOptimizations();
  }, [recommendations, onComplete]);

  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Spinner */}
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl glass border border-primary/30 flex items-center justify-center"
        animate={{
          boxShadow: [
            '0 0 0px hsl(var(--glow-primary)/0)',
            '0 0 24px hsl(var(--glow-primary)/0.4)',
            '0 0 0px hsl(var(--glow-primary)/0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Loader2 className="w-10 h-10 text-primary animate-spin" strokeWidth={1.5} />
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold mb-2">Applying Optimizations</h2>
      <p className="text-muted-foreground mb-6">
        Please wait while we optimize your system...
      </p>

      {/* Progress bar */}
      <div className="w-72 mx-auto mb-8">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {completedIds.size} of {recommendations.length} complete
        </p>
      </div>

      {/* Recommendations checklist */}
      <div className="rounded-xl p-4 max-w-sm mx-auto bg-white/[0.02] border border-white/[0.04]">
        <div className="space-y-2">
          {recommendations.map((rec, index) => {
            const isComplete = completedIds.has(rec.id);
            const isCurrent = index === currentIndex && !isComplete;

            return (
              <motion.div
                key={rec.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-left',
                  isCurrent && 'bg-primary/10',
                  isComplete && 'opacity-60'
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Status icon */}
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    isComplete ? 'bg-success/20 text-success' : isCurrent ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Circle className="w-3.5 h-3.5" strokeWidth={2} />
                  )}
                </div>

                {/* Name */}
                <span
                  className={cn(
                    'text-sm truncate',
                    isComplete ? 'text-success' : isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {rec.name}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default ApplyStep;
