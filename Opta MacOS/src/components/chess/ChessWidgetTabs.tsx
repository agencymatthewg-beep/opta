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

import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Puzzle, Brain, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PuzzleBoard } from './puzzles';
import { useTutoring } from '@/hooks/useTutoring';
import type { LessonCategory } from '@/types/tutoring';

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
  { id: 'tutor', label: 'Tutor', icon: Brain, available: true },
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
 * Category config for lesson display.
 */
const categoryConfig: Record<LessonCategory, { label: string; emoji: string; color: string }> = {
  opening: { label: 'Openings', emoji: '♟️', color: 'text-primary' },
  tactic: { label: 'Tactics', emoji: '⚔️', color: 'text-warning' },
  strategy: { label: 'Strategy', emoji: '🎯', color: 'text-info' },
  endgame: { label: 'Endgames', emoji: '👑', color: 'text-success' },
  checkmate: { label: 'Checkmates', emoji: '♔', color: 'text-danger' },
};

/**
 * Tutor tab content - Lesson browser and quick start.
 */
function TutorTab() {
  const { progress, actions, lessons, stats } = useTutoring();
  const [selectedCategory, setSelectedCategory] = useState<LessonCategory | null>(null);

  // If a lesson is active, show progress
  if (progress.isLessonActive && progress.currentLesson) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: smoothOut }}
        className="flex flex-col py-4 px-2"
      >
        {/* Active lesson info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" strokeWidth={1.75} />
            <span className="text-sm font-medium text-foreground">
              {progress.currentLesson.title}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {progress.currentStepIndex + 1}/{progress.totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((progress.currentStepIndex + 1) / progress.totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Current step */}
        {progress.currentStep && (
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
            {progress.currentStep.content}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => actions.nextStep()}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium',
              'bg-primary/20 hover:bg-primary/30',
              'border border-primary/30',
              'text-primary transition-colors'
            )}
          >
            Continue
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => actions.endLesson(true)}
            className={cn(
              'py-2 px-3 rounded-lg text-sm',
              'bg-white/5 hover:bg-white/10',
              'text-muted-foreground transition-colors'
            )}
          >
            Exit
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // If a category is selected, show lessons in that category
  if (selectedCategory) {
    const categoryLessons = lessons.getLessonsByCategory(selectedCategory);
    const config = categoryConfig[selectedCategory];

    return (
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2, ease: smoothOut }}
        className="flex flex-col py-2"
      >
        {/* Header */}
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'flex items-center gap-2 mb-3 px-2 py-1 -ml-1 rounded-lg',
            'text-xs text-muted-foreground hover:text-foreground',
            'hover:bg-white/5 transition-colors'
          )}
        >
          <ChevronRight className="w-3 h-3 rotate-180" strokeWidth={2} />
          Back
        </button>

        <div className="flex items-center gap-2 mb-3 px-2">
          <span className="text-sm">{config.emoji}</span>
          <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
        </div>

        {/* Lesson list */}
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
          {categoryLessons.map((lesson) => {
            const isCompleted = lessons.isLessonCompleted(lesson.id);
            return (
              <motion.button
                key={lesson.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => actions.startLesson(lesson.id)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-left',
                  'bg-white/5 hover:bg-white/10',
                  'border border-white/5 hover:border-white/10',
                  'transition-colors'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">{lesson.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {lesson.estimatedMinutes} min • {lesson.difficulty}
                  </span>
                </div>
                {isCompleted && (
                  <span className="text-[10px] text-success">✓</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // Default: Category selector
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: smoothOut }}
      className="flex flex-col py-4 px-2"
    >
      {/* Stats summary */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-primary" strokeWidth={1.75} />
          <span className="text-xs font-medium text-foreground">
            {stats.lessonsCompleted}
          </span>
          <span className="text-[10px] text-muted-foreground">completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">
            {Math.round(stats.overallSuccessRate * 100)}%
          </span>
          <span className="text-[10px] text-muted-foreground">success</span>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(categoryConfig) as LessonCategory[]).map((category) => {
          const config = categoryConfig[category];
          const categoryLessons = lessons.getLessonsByCategory(category);
          const completedCount = categoryLessons.filter((l) =>
            lessons.isLessonCompleted(l.id)
          ).length;

          return (
            <motion.button
              key={category}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl',
                'bg-white/5 hover:bg-white/10',
                'border border-white/5 hover:border-white/10',
                'transition-colors'
              )}
            >
              <span className="text-lg">{config.emoji}</span>
              <span className={cn('text-xs font-medium', config.color)}>
                {config.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {completedCount}/{categoryLessons.length}
              </span>
            </motion.button>
          );
        })}
      </div>
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
            <TutorTab key="tutor" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ChessWidgetTabs;
