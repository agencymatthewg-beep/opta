/**
 * LearnModeToggle - Floating toggle button for Learn Mode.
 *
 * Always visible in the UI (not buried in Settings) as per design requirements.
 * Provides quick access to educational explanations throughout the app.
 */

import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { useLearnMode } from './LearnModeContext';
import { cn } from '@/lib/utils';

export function LearnModeToggle() {
  const { isLearnMode, toggleLearnMode } = useLearnMode();

  return (
    <motion.button
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full',
        'glass border border-border/30 shadow-lg',
        'transition-all duration-200',
        isLearnMode && 'bg-primary/20 border-primary/50 shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.4)]'
      )}
      onClick={toggleLearnMode}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isLearnMode ? 'Turn off Learn Mode' : 'Turn on Learn Mode'}
      aria-pressed={isLearnMode}
    >
      <GraduationCap
        className={cn(
          'w-5 h-5 transition-colors',
          isLearnMode ? 'text-primary' : 'text-muted-foreground'
        )}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          'text-sm font-medium transition-colors',
          isLearnMode ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        Learn
      </span>
      {isLearnMode && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium"
        >
          ON
        </motion.span>
      )}
    </motion.button>
  );
}

export default LearnModeToggle;
