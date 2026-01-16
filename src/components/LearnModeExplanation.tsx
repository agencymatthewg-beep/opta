/**
 * LearnModeExplanation - Reusable explanation components for Learn Mode.
 *
 * When Learn Mode is active, these components display educational content
 * to help users understand what Opta is doing and why.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, HelpCircle, ChevronRight } from 'lucide-react';
import { useLearnMode } from './LearnModeContext';
import { cn } from '@/lib/utils';

type ExplanationType = 'info' | 'tip' | 'how-it-works';

interface LearnModeExplanationProps {
  /** Title of the explanation */
  title: string;
  /** Main description text */
  description: string;
  /** Optional technical details (expandable) */
  details?: string;
  /** Type of explanation (affects styling) */
  type?: ExplanationType;
  /** Optional additional className */
  className?: string;
}

/**
 * Main explanation component - shows a styled card when Learn Mode is active.
 */
export function LearnModeExplanation({
  title,
  description,
  details,
  type = 'info',
  className,
}: LearnModeExplanationProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  const Icon = {
    info: Info,
    tip: Lightbulb,
    'how-it-works': HelpCircle,
  }[type];

  const colors = {
    info: 'text-primary border-primary/30 bg-primary/10',
    tip: 'text-success border-success/30 bg-success/10',
    'how-it-works': 'text-warning border-warning/30 bg-warning/10',
  }[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        className={cn(
          'rounded-lg border p-3 my-2',
          colors,
          className
        )}
      >
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{title}</div>
            <div className="text-sm opacity-80 leading-relaxed">{description}</div>
            {details && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                  Technical details
                </summary>
                <p className="text-xs mt-1 opacity-70 pl-4 leading-relaxed">{details}</p>
              </details>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface LearnModeHintProps {
  /** The content to wrap with a hint */
  children: React.ReactNode;
  /** The hint text to show on hover */
  hint: string;
}

/**
 * Compact inline hint - shows tooltip-style hint on hover when Learn Mode is active.
 */
export function LearnModeHint({ children, hint }: LearnModeHintProps) {
  const { isLearnMode } = useLearnMode();

  return (
    <span className="relative group inline-flex items-center">
      {children}
      {isLearnMode && (
        <span className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'px-2.5 py-1.5 text-xs font-medium',
          'bg-primary text-primary-foreground rounded-lg',
          'whitespace-nowrap opacity-0 group-hover:opacity-100',
          'transition-opacity duration-200 pointer-events-none',
          'shadow-lg z-50'
        )}>
          {hint}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-primary" />
        </span>
      )}
    </span>
  );
}

interface LearnModeSectionProps {
  /** Title for the section */
  title: string;
  /** Description content */
  children: React.ReactNode;
  /** Type of explanation */
  type?: ExplanationType;
  /** Optional className */
  className?: string;
}

/**
 * Section wrapper - wraps content with Learn Mode explanation header.
 * Only shows the header when Learn Mode is active.
 */
export function LearnModeSection({
  title,
  children,
  type = 'info',
  className,
}: LearnModeSectionProps) {
  const { isLearnMode } = useLearnMode();

  const Icon = {
    info: Info,
    tip: Lightbulb,
    'how-it-works': HelpCircle,
  }[type];

  const iconColors = {
    info: 'text-primary bg-primary/10',
    tip: 'text-success bg-success/10',
    'how-it-works': 'text-warning bg-warning/10',
  }[type];

  return (
    <div className={className}>
      <AnimatePresence>
        {isLearnMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 mb-2"
          >
            <div className={cn('p-1 rounded-md', iconColors)}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

export default LearnModeExplanation;
