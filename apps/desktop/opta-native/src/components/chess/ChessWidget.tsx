/**
 * ChessWidget - Floating draggable chess widget for quick access.
 *
 * Features:
 * - Floating container with fixed positioning
 * - Framer Motion drag with constraints
 * - Collapsed state: Glanceable status
 * - Expanded state: Three-tab interface
 * - Position persistence via localStorage
 * - Glass styling matching Opta aesthetic
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { Crown, Minus, X, GripVertical, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChessWidgetStatus } from './ChessWidgetStatus';
import { ChessWidgetTabs, type ChessWidgetTab } from './ChessWidgetTabs';
import { MiniChessBoard } from './MiniChessBoard';
import { usePuzzle } from '@/hooks/usePuzzle';
import { ChessSettingsPanel } from './settings/ChessSettingsPanel';
import { useChessSettingsOptional } from '@/contexts/ChessSettingsContext';

// LocalStorage keys
const WIDGET_POSITION_KEY = 'opta_chess_widget_position';
const WIDGET_EXPANDED_KEY = 'opta_chess_widget_expanded';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Default widget position (bottom right corner with padding)
const DEFAULT_POSITION = { x: -20, y: -20 }; // Negative means from bottom-right

export interface ChessWidgetProps {
  /** Whether the widget is visible */
  isVisible: boolean;
  /** Callback to close/hide the widget */
  onClose: () => void;
  /** Callback to navigate to full chess page */
  onNavigateToChess?: () => void;
}

/**
 * Load position from localStorage.
 */
function loadPosition(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(WIDGET_POSITION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_POSITION;
}

/**
 * Save position to localStorage.
 */
function savePosition(position: { x: number; y: number }) {
  localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(position));
}

/**
 * Load expansion state from localStorage.
 */
function loadExpanded(): boolean {
  try {
    const saved = localStorage.getItem(WIDGET_EXPANDED_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
}

/**
 * Floating chess widget component.
 */
export function ChessWidget({
  isVisible,
  onClose,
  onNavigateToChess,
}: ChessWidgetProps) {
  // Widget state
  const [isExpanded, setIsExpanded] = useState(loadExpanded);
  const [activeTab, setActiveTab] = useState<ChessWidgetTab>('play');
  const [position, setPosition] = useState(loadPosition);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Chess settings from context (with fallback)
  const { settings, updateSettings } = useChessSettingsOptional();

  // Chess game state (for status display)
  const [isYourTurn, setIsYourTurn] = useState(true);

  // Puzzle state from usePuzzle hook
  const { stats: puzzleStats, dailyPuzzleCompleted, hasDailyPuzzle } = usePuzzle({
    autoFetchDaily: true,
  });
  const hasPendingPuzzle = hasDailyPuzzle && !dailyPuzzleCompleted;
  const puzzleStreak = puzzleStats.currentStreak;

  // Drag controls
  const dragControls = useDragControls();

  // Save expanded state
  useEffect(() => {
    localStorage.setItem(WIDGET_EXPANDED_KEY, String(isExpanded));
  }, [isExpanded]);

  // Handle drag end - save position
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const newPosition = {
        x: position.x + info.offset.x,
        y: position.y + info.offset.y,
      };
      setPosition(newPosition);
      savePosition(newPosition);
    },
    [position]
  );

  // Handle status click to expand
  const handleStatusClick = useCallback(() => {
    setIsExpanded(true);
  }, []);

  // Handle turn change from mini board
  const handleTurnChange = useCallback((yourTurn: boolean) => {
    setIsYourTurn(yourTurn);
  }, []);

  // Toggle expansion
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle navigate to full chess page
  const handleOpenFullBoard = useCallback(() => {
    onNavigateToChess?.();
    onClose();
  }, [onNavigateToChess, onClose]);

  // Render play content for tabs
  const playContent = (
    <MiniChessBoard
      onOpenFullBoard={handleOpenFullBoard}
      onTurnChange={handleTurnChange}
    />
  );

  // Calculate widget dimensions
  const collapsedWidth = 200;
  const expandedWidth = 280;
  const expandedHeight = 380;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: smoothOut }}
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={{
          top: -window.innerHeight + 100,
          left: -window.innerWidth + 100,
          right: 0,
          bottom: 0,
        }}
        onDragEnd={handleDragEnd}
        style={{
          position: 'fixed',
          right: -position.x,
          bottom: -position.y,
          zIndex: 45, // Below modals (50) but above content
        }}
        className={cn(
          'rounded-xl overflow-hidden',
          'glass',
          'border border-white/[0.08]',
          'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]',
          'shadow-[0_0_24px_-8px_rgba(168,85,247,0.15)]'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2',
            'border-b border-white/[0.06]',
            'bg-black/20'
          )}
        >
          {/* Drag Handle + Title */}
          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => dragControls.start(e)}
              className={cn(
                'p-1 -ml-1 cursor-grab active:cursor-grabbing',
                'text-muted-foreground/40 hover:text-muted-foreground/60',
                'transition-colors'
              )}
            >
              <GripVertical className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-primary" strokeWidth={1.75} />
              <span className="text-xs font-semibold text-foreground">Chess</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Chess Settings (opens full settings modal) */}
            {isExpanded && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowSettingsModal(true)}
                className={cn(
                  'p-1 rounded-md',
                  'text-muted-foreground/40 hover:text-primary/70',
                  'hover:bg-primary/10 transition-colors'
                )}
                title="Chess settings"
              >
                <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
              </motion.button>
            )}

            {/* Expand/Collapse */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleExpanded}
              className={cn(
                'p-1 rounded-md',
                'text-muted-foreground/40 hover:text-muted-foreground/60',
                'hover:bg-white/5 transition-colors'
              )}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
              )}
            </motion.button>

            {/* Minimize (collapse and keep visible) */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsExpanded(false)}
              className={cn(
                'p-1 rounded-md',
                'text-muted-foreground/40 hover:text-muted-foreground/60',
                'hover:bg-white/5 transition-colors'
              )}
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" strokeWidth={2} />
            </motion.button>

            {/* Close */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={cn(
                'p-1 rounded-md',
                'text-muted-foreground/40 hover:text-danger/80',
                'hover:bg-danger/10 transition-colors'
              )}
              title="Close widget"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <motion.div
          animate={{
            width: isExpanded ? expandedWidth : collapsedWidth,
            height: isExpanded ? expandedHeight : 'auto',
          }}
          transition={{ duration: 0.25, ease: smoothOut }}
          className="overflow-hidden"
        >
          {/* Collapsed: Glanceable Status */}
          {!isExpanded && (
            <div className="p-2">
              <ChessWidgetStatus
                isYourTurn={isYourTurn}
                hasPendingPuzzle={hasPendingPuzzle}
                puzzleStreak={puzzleStreak}
                onClick={handleStatusClick}
              />
            </div>
          )}

          {/* Expanded: Three-Tab Interface */}
          {isExpanded && (
            <div className="p-3">
              <ChessWidgetTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                playContent={playContent}
              />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Chess Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowSettingsModal(false)}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: smoothOut }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto',
                'rounded-2xl p-5',
                'glass-strong',
                'border border-white/[0.1]',
                'shadow-[0_8px_64px_-16px_rgba(168,85,247,0.4)]'
              )}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Settings className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Chess Settings</h2>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSettingsModal(false)}
                  className={cn(
                    'p-1.5 rounded-lg',
                    'text-muted-foreground/50 hover:text-foreground',
                    'hover:bg-white/5 transition-colors'
                  )}
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </motion.button>
              </div>

              {/* Settings panel */}
              <ChessSettingsPanel
                settings={settings}
                onSettingsChange={updateSettings}
                compact
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

export default ChessWidget;
