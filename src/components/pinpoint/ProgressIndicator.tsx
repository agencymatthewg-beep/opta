import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WizardStep } from '../../pages/PinpointOptimize';
import { Target, Gamepad2, Search, ClipboardCheck, Wrench, CheckCircle2 } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: WizardStep;
}

const STEPS: { id: WizardStep; label: string; icon: typeof Target }[] = [
  { id: 'select-goal', label: 'Goal', icon: Target },
  { id: 'select-game', label: 'Game', icon: Gamepad2 },
  { id: 'analyze', label: 'Analyze', icon: Search },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
  { id: 'apply', label: 'Apply', icon: Wrench },
  { id: 'results', label: 'Done', icon: CheckCircle2 },
];

/**
 * ProgressIndicator - Shows wizard progress.
 *
 * Displays steps as connected dots with labels.
 * Current step is highlighted, completed steps show check marks.
 */
export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <motion.div
      className="flex items-center justify-center mb-8"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex items-center">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step dot */}
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'border-2 transition-all duration-300',
                    isActive && 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_-4px_hsl(var(--glow-primary)/0.5)]',
                    isComplete && 'bg-success/20 border-success text-success',
                    !isActive && !isComplete && 'bg-muted/30 border-border/50 text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                  ) : (
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-medium mt-1.5 uppercase tracking-wider',
                    isActive && 'text-primary',
                    isComplete && 'text-success',
                    !isActive && !isComplete && 'text-muted-foreground/60'
                  )}
                >
                  {step.label}
                </span>
              </motion.div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1 -mt-4',
                    index < currentIndex ? 'bg-success' : 'bg-border/50'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default ProgressIndicator;
