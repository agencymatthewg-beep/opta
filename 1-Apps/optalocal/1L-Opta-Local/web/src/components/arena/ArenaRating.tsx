'use client';

import { motion } from 'framer-motion';
import { cn } from '@opta/ui';
import { Trophy, Equal } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArenaRatingProps {
  models: string[];
  onRate: (winner: string | 'tie') => void;
  disabled: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Rating bar that appears after all arena models finish streaming.
 *
 * Presents one button per model ("Model X wins") plus a "Tie" button.
 * Uses Framer Motion for entrance animation. Disabled state prevents
 * rating during active streaming.
 */
export function ArenaRating({ models, onRate, disabled }: ArenaRatingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-subtle rounded-xl px-4 py-3"
    >
      <p className="text-xs text-text-muted text-center mb-3">
        Which response was better?
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {models.map((modelId, index) => (
          <button
            key={modelId}
            onClick={() => onRate(modelId)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-all duration-200',
              'glass-subtle',
              disabled
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-primary/15 hover:text-primary active:scale-95',
              'text-text-primary',
            )}
          >
            <Trophy className="w-3.5 h-3.5 text-neon-amber" />
            <span className="truncate max-w-[160px]">
              {getModelLabel(index)} wins
            </span>
          </button>
        ))}
        <button
          onClick={() => onRate('tie')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'transition-all duration-200',
            'glass-subtle',
            disabled
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-text-secondary/15 hover:text-text-primary active:scale-95',
            'text-text-secondary',
          )}
        >
          <Equal className="w-3.5 h-3.5" />
          <span>Tie</span>
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a model index to a letter label: 0 -> "A", 1 -> "B", 2 -> "C".
 */
function getModelLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
