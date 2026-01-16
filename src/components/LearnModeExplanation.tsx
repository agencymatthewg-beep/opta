/**
 * LearnModeExplanation - Reusable explanation components for Learn Mode.
 *
 * When Learn Mode is active, these components display educational content
 * to help users understand what Opta is doing and why.
 *
 * Explanations adapt to user expertise level:
 * - simple: Plain language, essential information only
 * - standard: Balanced explanations with helpful context
 * - power: Full technical details always visible
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, HelpCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { useLearnMode } from './LearnModeContext';
import { useExpertise } from './ExpertiseContext';
import { useCommunicationStyle } from './CommunicationStyleContext';
import { useExpertiseTracking } from '@/hooks/useExpertise';
import { cn } from '@/lib/utils';

type ExplanationType = 'info' | 'tip' | 'how-it-works';

interface ExpertiseLevelContent {
  /** Simple explanation for beginners */
  simple: string;
  /** Standard explanation for regular users */
  standard: string;
  /** Detailed explanation for power users */
  power: string;
}

interface LearnModeExplanationProps {
  /** Title of the explanation */
  title: string;
  /** Main description text (or expertise-level content object) */
  description: string | ExpertiseLevelContent;
  /** Short description for concise mode (optional, falls back to truncating description) */
  shortDescription?: string;
  /** Optional technical details (expandable for simple/standard, always shown for power) */
  details?: string;
  /** Type of explanation (affects styling) */
  type?: ExplanationType;
  /** Optional additional className */
  className?: string;
}

/**
 * Main explanation component - shows a styled card when Learn Mode is active.
 * Adapts content complexity to user expertise level and communication style.
 */
export function LearnModeExplanation({
  title,
  description,
  shortDescription,
  details,
  type = 'info',
  className,
}: LearnModeExplanationProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();
  const { isVerbose } = useCommunicationStyle();
  const { trackTechnicalExpand } = useExpertiseTracking();
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (!isLearnMode) return null;

  // Get the appropriate description based on expertise level
  const fullDescriptionText =
    typeof description === 'string'
      ? description
      : description[level] || description.standard;

  // In concise mode, use short description or show truncated version with "Learn more"
  const displayDescription = isVerbose
    ? fullDescriptionText
    : (shortDescription || fullDescriptionText);

  // Show "Learn more" button if in concise mode and we have more content
  const hasMoreContent = !isVerbose && !shortDescription && fullDescriptionText.length > 100;

  // Power users always see technical details expanded
  const showTechnicalDetails = level === 'power';
  const hasExpandableDetails = details && !showTechnicalDetails;

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

  const handleExpandDetails = useCallback(() => {
    setExpanded(true);
    trackTechnicalExpand();
  }, [trackTechnicalExpand]);

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
            <div className="text-sm opacity-80 leading-relaxed">
              {hasMoreContent && !showMore
                ? displayDescription.slice(0, 100) + '...'
                : displayDescription}
            </div>

            {/* "Learn more" button for concise mode when content is truncated */}
            {hasMoreContent && !showMore && (
              <button
                onClick={() => setShowMore(true)}
                className="mt-1 text-xs cursor-pointer text-primary hover:underline"
              >
                Learn more...
              </button>
            )}

            {/* Technical details - expandable for simple/standard, always visible for power */}
            {showTechnicalDetails && details && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-xs mt-2 opacity-70 italic leading-relaxed border-t border-current/20 pt-2"
              >
                {details}
              </motion.p>
            )}

            {/* Only show technical details expansion when in verbose mode or user expanded */}
            {hasExpandableDetails && isVerbose && !expanded && (
              <button
                onClick={handleExpandDetails}
                className="mt-2 text-xs cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                Technical details
              </button>
            )}

            {hasExpandableDetails && expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-2 text-xs cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
                  Technical details
                </button>
                <p className="text-xs mt-1 opacity-70 pl-4 leading-relaxed">{details}</p>
              </motion.div>
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
  /** The hint text to show on hover (or expertise-level content) */
  hint: string | ExpertiseLevelContent;
  /** Short hint for concise mode (optional) */
  shortHint?: string;
}

/**
 * Compact inline hint - shows tooltip-style hint on hover when Learn Mode is active.
 * Adapts hint content to user expertise level and communication style.
 */
export function LearnModeHint({ children, hint, shortHint }: LearnModeHintProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();
  const { isVerbose } = useCommunicationStyle();

  // Get the appropriate hint based on expertise level
  const fullHintText = typeof hint === 'string' ? hint : hint[level] || hint.standard;

  // In concise mode, use short hint if provided
  const hintText = isVerbose ? fullHintText : (shortHint || fullHintText);

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
          {hintText}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-primary" />
        </span>
      )}
    </span>
  );
}

interface LearnModeSectionProps {
  /** Title for the section (or expertise-level content) */
  title: string | ExpertiseLevelContent;
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
 * Adapts title to user expertise level.
 */
export function LearnModeSection({
  title,
  children,
  type = 'info',
  className,
}: LearnModeSectionProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();

  // Get the appropriate title based on expertise level
  const titleText = typeof title === 'string' ? title : title[level] || title.standard;

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
            <span className="text-xs font-medium text-muted-foreground">{titleText}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

export default LearnModeExplanation;
