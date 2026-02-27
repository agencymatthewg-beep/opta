'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { cn } from '@opta/ui';

interface ForkButtonProps {
  /** Index of the message to fork at. */
  messageIndex: number;
  /** Callback when the user clicks fork. */
  onFork: (atIndex: number) => void;
}

/**
 * Small icon button that appears on hover of any chat message.
 * Clicking it forks the conversation from that message onward,
 * creating a new branch session.
 */
export function ForkButton({ messageIndex, onFork }: ForkButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFork(messageIndex);
    },
    [messageIndex, onFork],
  );

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.85 }}
      className={cn(
        'absolute top-2 right-2 z-10',
        'p-1.5 rounded-lg glass-subtle',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
        'text-text-secondary hover:text-primary hover:bg-primary/10',
        'cursor-pointer',
      )}
      aria-label="Fork conversation from here"
      title="Fork conversation from here"
    >
      <GitBranch className="w-3.5 h-3.5" />
    </motion.button>
  );
}
