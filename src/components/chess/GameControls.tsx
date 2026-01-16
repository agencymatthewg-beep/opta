/**
 * GameControls - Chess Game Control Panel
 *
 * Provides game controls for chess: difficulty selector, new game, undo, resign.
 * Follows Opta's Obsidian design system with glass styling.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { RefreshCw, Undo2, Flag, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MotionButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AIDifficulty } from '@/types/chess';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface GameControlsProps {
  /** Current AI difficulty level */
  difficulty: AIDifficulty;
  /** Callback when difficulty changes */
  onDifficultyChange: (difficulty: AIDifficulty) => void;
  /** Callback to start a new game */
  onNewGame: () => void;
  /** Callback to undo the last move */
  onUndo: () => void;
  /** Callback when player resigns */
  onResign: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether the game has ended */
  isGameOver: boolean;
  /** Whether the AI is currently thinking */
  isThinking: boolean;
}

// Difficulty options with labels and descriptions
const difficultyOptions: Array<{
  value: AIDifficulty;
  label: string;
  description: string;
}> = [
  { value: 'beginner', label: 'Beginner', description: 'Makes obvious mistakes' },
  { value: 'casual', label: 'Casual', description: 'Club player level' },
  { value: 'intermediate', label: 'Intermediate', description: 'Strong amateur' },
  { value: 'advanced', label: 'Advanced', description: 'Expert level' },
  { value: 'maximum', label: 'Maximum', description: 'Near-perfect play' },
];

/**
 * GameControls component for chess game management.
 */
export function GameControls({
  difficulty,
  onDifficultyChange,
  onNewGame,
  onUndo,
  onResign,
  canUndo,
  isGameOver,
  isThinking,
}: GameControlsProps) {
  const currentDifficulty = difficultyOptions.find((d) => d.value === difficulty);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5) blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1) blur(0px)' }}
      transition={{ duration: 0.5, delay: 0.1, ease: smoothOut }}
      className={cn(
        'rounded-xl p-4',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
      )}
    >
      <div className="flex flex-col gap-4">
        {/* AI Thinking indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
              'bg-primary/10 border border-primary/20'
            )}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-4 h-4 text-primary" strokeWidth={2} />
            </motion.div>
            <motion.span
              className="text-sm text-primary font-medium"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              AI is thinking...
            </motion.span>
          </motion.div>
        )}

        {/* Difficulty Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Difficulty
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center justify-between w-full px-3 py-2 rounded-lg',
                  'bg-[#0a0514]/60 backdrop-blur-lg',
                  'border border-white/[0.08]',
                  'text-sm text-foreground',
                  'transition-all duration-200',
                  'hover:border-primary/30 hover:bg-[#0a0514]/80',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                <span>{currentDifficulty?.label || 'Select'}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                'min-w-[200px]',
                'bg-[#05030a]/95 backdrop-blur-xl',
                'border border-white/[0.1]'
              )}
              align="start"
            >
              {difficultyOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onDifficultyChange(option.value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 cursor-pointer',
                    'focus:bg-primary/20',
                    option.value === difficulty && 'bg-primary/10'
                  )}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* New Game */}
          <MotionButton
            variant="obsidian"
            size="sm"
            onClick={onNewGame}
            className="flex-1 gap-2"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
            <span>New Game</span>
          </MotionButton>

          {/* Undo */}
          <MotionButton
            variant="ghost"
            size="icon-sm"
            onClick={onUndo}
            disabled={!canUndo || isThinking}
            className={cn(
              'transition-opacity duration-200',
              (!canUndo || isThinking) && 'opacity-40'
            )}
            title="Undo last move"
          >
            <Undo2 className="w-4 h-4" strokeWidth={1.75} />
          </MotionButton>

          {/* Resign */}
          <MotionButton
            variant="ghost"
            size="icon-sm"
            onClick={onResign}
            disabled={isGameOver || isThinking}
            className={cn(
              'transition-opacity duration-200',
              'hover:text-danger hover:bg-danger/10',
              (isGameOver || isThinking) && 'opacity-40'
            )}
            title="Resign game"
          >
            <Flag className="w-4 h-4" strokeWidth={1.75} />
          </MotionButton>
        </div>
      </div>
    </motion.div>
  );
}

export default GameControls;
