/**
 * AdaptiveExplanation - Expertise-adaptive explanation component.
 *
 * Adapts explanation depth based on user's expertise level:
 * - simple: Plain language for beginners
 * - standard: Balanced explanations for regular users
 * - power: Full technical details for advanced users
 *
 * Power users see an "Advanced:" section with technical details
 * that can be toggled on/off.
 */

import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { useExpertise } from './ExpertiseContext';
import { useExpertiseTracking } from '@/hooks/useExpertise';
import { cn } from '@/lib/utils';

import { ChevronDown, ChevronRight } from 'lucide-react';

export interface AdaptiveExplanationProps {
  /** Simple explanation for beginners */
  simple: string;
  /** Standard explanation for regular users */
  standard: string;
  /** Advanced explanation for power users */
  advanced: string;
  /** Optional technical details (shown in expandable section for power users) */
  technicalDetails?: string;
  /** Optional className for styling */
  className?: string;
}

/**
 * AdaptiveExplanation component - Shows explanation based on user expertise.
 */
export function AdaptiveExplanation({
  simple,
  standard,
  advanced,
  technicalDetails,
  className,
}: AdaptiveExplanationProps) {
  const { level } = useExpertise();
  const { trackTechnicalExpand } = useExpertiseTracking();
  const [showTechnical, setShowTechnical] = useState(false);

  // Map expertise level to explanation
  const explanation = {
    simple,
    standard,
    power: advanced,
  }[level];

  const handleToggleTechnical = () => {
    if (!showTechnical) {
      trackTechnicalExpand();
    }
    setShowTechnical(!showTechnical);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>

      {/* Technical details section for power users */}
      {level === 'power' && technicalDetails && (
        <>
          <AnimatePresence initial={false}>
            {showTechnical && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="glass-subtle rounded-lg p-3 mt-2 border border-border/20">
                  <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                    <span className="text-primary font-semibold">Advanced: </span>
                    {technicalDetails}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleToggleTechnical}
            className={cn(
              'flex items-center gap-1 text-xs text-primary',
              'hover:underline cursor-pointer',
              'transition-colors duration-150'
            )}
            whileTap={{ scale: 0.98 }}
          >
            {showTechnical ? (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            {showTechnical ? 'Hide' : 'Show'} technical details
          </motion.button>
        </>
      )}
    </div>
  );
}

export default AdaptiveExplanation;
