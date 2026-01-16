/**
 * MoveHistory - Chess Move History Display
 *
 * Displays chess moves in standard notation with scrollable history.
 * Features move pair display (white/black per row) and last move highlighting.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChessMove } from '@/types/chess';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface MoveHistoryProps {
  /** Array of moves in the game */
  history: ChessMove[];
  /** Callback when clicking a move (for future navigation) */
  onMoveClick?: (moveIndex: number) => void;
  /** Maximum height for the scroll area */
  maxHeight?: string;
}

/**
 * Group moves into pairs (white move, black move per row).
 */
function groupMovesByPair(moves: ChessMove[]): Array<{
  number: number;
  white: ChessMove | null;
  black: ChessMove | null;
}> {
  const pairs: Array<{ number: number; white: ChessMove | null; black: ChessMove | null }> = [];

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i] || null,
      black: moves[i + 1] || null,
    });
  }

  return pairs;
}

/**
 * MoveHistory component for displaying chess game moves.
 */
export function MoveHistory({
  history,
  onMoveClick,
  maxHeight = '200px',
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length]);

  const movePairs = groupMovesByPair(history);
  const lastMoveIndex = history.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5) blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1) blur(0px)' }}
      transition={{ duration: 0.5, delay: 0.2, ease: smoothOut }}
      className={cn(
        'rounded-xl overflow-hidden',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.05]">
        <h3 className="text-sm font-medium text-muted-foreground">Move History</h3>
      </div>

      {/* Move list */}
      <ScrollArea style={{ maxHeight }} className="relative">
        <div ref={scrollRef} className="p-2">
          {history.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No moves yet
            </div>
          ) : (
            <div className="space-y-0.5">
              <AnimatePresence mode="popLayout">
                {movePairs.map((pair, pairIndex) => (
                  <motion.div
                    key={pair.number}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: smoothOut }}
                    className={cn(
                      'grid grid-cols-[32px_1fr_1fr] gap-1 px-2 py-1 rounded-md',
                      'text-sm font-mono',
                      // Subtle row separator
                      pairIndex % 2 === 1 && 'bg-white/[0.02]'
                    )}
                  >
                    {/* Move number */}
                    <span className="text-muted-foreground tabular-nums">
                      {pair.number}.
                    </span>

                    {/* White's move */}
                    <MoveCell
                      move={pair.white}
                      moveIndex={pairIndex * 2}
                      isLastMove={pairIndex * 2 === lastMoveIndex}
                      onClick={onMoveClick}
                    />

                    {/* Black's move */}
                    <MoveCell
                      move={pair.black}
                      moveIndex={pairIndex * 2 + 1}
                      isLastMove={pairIndex * 2 + 1 === lastMoveIndex}
                      onClick={onMoveClick}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

interface MoveCellProps {
  move: ChessMove | null;
  moveIndex: number;
  isLastMove: boolean;
  onClick?: (moveIndex: number) => void;
}

/**
 * Individual move cell in the history.
 */
function MoveCell({ move, moveIndex, isLastMove, onClick }: MoveCellProps) {
  if (!move) {
    return <span className="text-muted-foreground/30">...</span>;
  }

  return (
    <motion.button
      initial={isLastMove ? { scale: 1.1, color: 'hsl(265, 90%, 65%)' } : {}}
      animate={{ scale: 1, color: isLastMove ? 'hsl(265, 90%, 65%)' : 'inherit' }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick?.(moveIndex)}
      disabled={!onClick}
      className={cn(
        'text-left px-1.5 py-0.5 rounded transition-colors duration-150',
        onClick && 'hover:bg-primary/10 cursor-pointer',
        isLastMove && [
          'text-primary font-semibold',
          'bg-primary/10',
          'shadow-[0_0_8px_rgba(168,85,247,0.3)]',
        ]
      )}
    >
      {move.san}
    </motion.button>
  );
}

export default MoveHistory;
