/**
 * ChessWidgetTabs - Three-tab navigation for the expanded chess widget.
 *
 * Tabs:
 * - Play: Mini chess board + quick controls
 * - Puzzles: Tactical puzzle training (Phase 52)
 * - Tutor: Coming in Phase 55 placeholder
 *
 * Uses AnimatePresence with mode="wait" for smooth tab transitions.
 *
 * @see DESIGN_SYSTEM.md - Framer Motion animations, Lucide icons
 */

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Puzzle, Brain, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PuzzleBoard } from './puzzles';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type ChessWidgetTab = 'play' | 'puzzles' | 'tutor';

interface TabConfig {
  id: ChessWidgetTab;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

const tabs: TabConfig[] = [
  { id: 'play', label: 'Play', icon: Crown, available: true },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle, available: true },
  { id: 'tutor', label: 'Tutor', icon: Brain, available: false },
];

export interface ChessWidgetTabsProps {
  /** Currently active tab */
  activeTab: ChessWidgetTab;
  /** Callback when tab changes */
  onTabChange: (tab: ChessWidgetTab) => void;
  /** Content to render for the Play tab */
  playContent: ReactNode;
}

/**
 * Coming soon placeholder for unavailable tabs.
 */
function ComingSoonPlaceholder({ tab }: { tab: 'tutor' }) {
  const config = {
    tutor: {
      title: 'Opta Tutor',
      description: 'Learn with personalized AI coaching',
      phase: '55',
    },
  };

  const { title, description, phase } = config[tab];
  const Icon = Brain;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: smoothOut }}
      className="flex flex-col items-center justify-center py-6 px-4 text-center"
    >
      <div
        className={cn(
          'w-12 h-12 mb-3 flex items-center justify-center rounded-xl',
          'bg-primary/10 border border-primary/20'
        )}
      >
        <Icon className="w-6 h-6 text-primary/70" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/70 mb-3">{description}</p>
      <span
        className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
          'bg-primary/10 text-primary/80 border border-primary/20'
        )}
      >
        Phase {phase}
      </span>
    </motion.div>
  );
}

/**
 * Three-tab navigation for the expanded chess widget.
 */
export function ChessWidgetTabs({
  activeTab,
  onTabChange,
  playContent,
}: ChessWidgetTabsProps) {
  return (
    <div className="flex flex-col">
      {/* Tab Bar */}
      <div
        className={cn(
          'flex p-1 rounded-lg mb-3',
          'bg-black/20 border border-white/5'
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-1.5',
                'py-1.5 px-2 rounded-md text-xs font-medium',
                isActive && 'text-foreground',
                !isActive && tab.available && 'text-muted-foreground/60 hover:text-muted-foreground',
                !tab.available && 'text-muted-foreground/40'
              )}
              whileHover={tab.available || tab.id === 'play' ? { scale: 1.02 } : undefined}
              whileTap={tab.available || tab.id === 'play' ? { scale: 0.98 } : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="chessWidgetTab"
                  className={cn(
                    'absolute inset-0 rounded-md',
                    'bg-primary/15 border border-primary/30'
                  )}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        <AnimatePresence mode="wait">
          {activeTab === 'play' && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: smoothOut }}
            >
              {playContent}
            </motion.div>
          )}
          {activeTab === 'puzzles' && (
            <motion.div
              key="puzzles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: smoothOut }}
            >
              <PuzzleBoard />
            </motion.div>
          )}
          {activeTab === 'tutor' && (
            <ComingSoonPlaceholder key="tutor" tab="tutor" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ChessWidgetTabs;
