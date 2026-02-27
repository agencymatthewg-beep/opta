/**
 * Chess Page - Ambient Chess Experience
 *
 * Three-mode chess page following the architecture from 17-RESEARCH.md:
 * 1. Casual Mode (default) - Play against AI with adjustable difficulty
 * 2. Puzzle Mode (v2.1) - Coming soon placeholder
 * 3. Analysis Mode (v2.1) - Coming soon placeholder
 *
 * Design philosophy: Relaxed, no-pressure gaming experience.
 * No visible win/loss counters, soft animations, "take your time" messaging.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 * @see .planning/phases/17-chess-integration/17-RESEARCH.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Puzzle, BarChart3, Loader2, Trophy, Handshake, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChessBoard, GameControls, MoveHistory } from '@/components/chess';
import { useChessGame } from '@/hooks/useChessGame';
import { useStockfish } from '@/hooks/useStockfish';
import { LearnModeExplanation } from '@/components/LearnModeExplanation';
import { RingLessonProvider, useRingLessonEnergy } from '@/contexts/RingLessonContext';
import { LessonOverlay, CongratulationBurst } from '@/components/chess/tutoring';
import type { ChessMode, AIDifficulty, ChessGameResult, ChessSettings } from '@/types/chess';
import { DIFFICULTY_TO_SKILL_LEVEL, DEFAULT_CHESS_SETTINGS } from '@/types/chess';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

// LocalStorage keys
const CHESS_SETTINGS_KEY = 'opta_chess_settings';
const CHESS_GAME_FEN_KEY = 'opta_chess_game_fen';

/**
 * Mode tab configuration
 */
const modeTabs: Array<{
  id: ChessMode;
  label: string;
  icon: LucideIcon;
  available: boolean;
}> = [
  { id: 'casual', label: 'Casual', icon: Crown, available: true },
  { id: 'puzzle', label: 'Puzzles', icon: Puzzle, available: false },
  { id: 'analysis', label: 'Analysis', icon: BarChart3, available: false },
];

/**
 * Game result messages for ambient UX
 */
const resultMessages: Record<NonNullable<ChessGameResult>, { title: string; subtitle: string; icon: LucideIcon }> = {
  checkmate: { title: 'Checkmate', subtitle: 'Well played!', icon: Trophy },
  stalemate: { title: 'Stalemate', subtitle: 'A draw by stalemate', icon: Handshake },
  draw: { title: 'Draw', subtitle: 'Game ended in a draw', icon: Minus },
  resignation: { title: 'Game Over', subtitle: 'Resigned', icon: Crown },
};

/**
 * Coming soon placeholder for unavailable modes
 */
function ComingSoonMode({ mode }: { mode: 'puzzle' | 'analysis' }) {
  const descriptions = {
    puzzle: {
      title: 'Tactical Puzzles',
      description: 'Sharpen your tactics with bite-sized challenges from the Lichess puzzle database.',
      features: ['3M+ rated puzzles', 'Adaptive difficulty', 'Streak tracking', 'Hints available'],
    },
    analysis: {
      title: 'Position Analysis',
      description: 'Deep dive into positions with Stockfish evaluation and opening explorer.',
      features: ['Engine evaluation bar', 'Best move arrows', 'Opening theory', 'Import PGN'],
    },
  };

  const config = descriptions[mode];
  const Icon = mode === 'puzzle' ? Puzzle : BarChart3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: smoothOut }}
      className="flex-1 flex items-center justify-center"
    >
      <div className={cn(
        'max-w-md w-full p-8 rounded-2xl text-center',
        'glass',
        'border border-white/[0.06]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
      )}>
        <motion.div
          className={cn(
            'w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-2xl',
            'bg-primary/10 border border-primary/20'
          )}
          animate={{
            boxShadow: [
              '0 0 20px -5px rgba(168, 85, 247, 0.2)',
              '0 0 30px -5px rgba(168, 85, 247, 0.4)',
              '0 0 20px -5px rgba(168, 85, 247, 0.2)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
        </motion.div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {config.title}
        </h2>
        <p className="text-sm text-muted-foreground/70 mb-6">
          {config.description}
        </p>

        <div className="text-left space-y-2 mb-6">
          {config.features.map((feature, index) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              {feature}
            </motion.div>
          ))}
        </div>

        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full',
          'bg-primary/10 text-primary text-sm font-medium',
          'border border-primary/20'
        )}>
          Coming in v2.1
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Game result banner with ambient styling
 */
function GameResultBanner({
  result,
  playerWon,
  onNewGame,
}: {
  result: NonNullable<ChessGameResult>;
  playerWon: boolean | null;
  onNewGame: () => void;
}) {
  const config = resultMessages[result];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.4, ease: smoothOut }}
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm rounded-xl'
      )}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: smoothOut }}
        className={cn(
          'p-8 rounded-2xl text-center',
          'glass-overlay',
          'border border-primary/30',
          'shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)]'
        )}
      >
        <motion.div
          className={cn(
            'w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl',
            playerWon ? 'bg-success/20 border border-success/30' : 'bg-primary/20 border border-primary/30'
          )}
          animate={{
            boxShadow: playerWon
              ? [
                  '0 0 20px -5px rgba(34, 197, 94, 0.3)',
                  '0 0 30px -5px rgba(34, 197, 94, 0.5)',
                  '0 0 20px -5px rgba(34, 197, 94, 0.3)',
                ]
              : [
                  '0 0 20px -5px rgba(168, 85, 247, 0.3)',
                  '0 0 30px -5px rgba(168, 85, 247, 0.5)',
                  '0 0 20px -5px rgba(168, 85, 247, 0.3)',
                ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon
            className={cn(
              'w-8 h-8',
              playerWon ? 'text-success' : 'text-primary'
            )}
            strokeWidth={1.5}
          />
        </motion.div>

        <h2 className="text-2xl font-bold text-foreground mb-1">
          {config.title}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {config.subtitle}
        </p>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewGame}
          className={cn(
            'px-6 py-3 rounded-xl font-semibold',
            'bg-primary text-white',
            'shadow-[0_0_20px_-5px_hsl(var(--primary))]',
            'transition-shadow duration-300',
            'hover:shadow-[0_0_30px_-5px_hsl(var(--primary))]'
          )}
        >
          Play Again
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/**
 * Casual mode - the main chess playing experience
 */
function CasualMode({
  settings,
  onSettingsChange,
}: {
  settings: ChessSettings;
  onSettingsChange: (settings: Partial<ChessSettings>) => void;
}) {
  // Track last move for highlighting
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Player won state for result banner
  const [playerWon, setPlayerWon] = useState<boolean | null>(null);

  // Inactivity hint
  const [showHint, setShowHint] = useState(false);
  const lastMoveTimeRef = useRef(Date.now());

  // Initialize chess game
  const {
    fen,
    history,
    isGameOver,
    result,
    turn,
    makeMove,
    undo,
    reset,
    getLegalMoves,
    loadFen,
  } = useChessGame({
    onGameOver: (gameResult) => {
      // Determine if player won (player is always white for now)
      if (gameResult === 'checkmate') {
        // If it's black's turn when checkmate happens, white (player) won
        setPlayerWon(turn === 'b');
      } else {
        setPlayerWon(null); // Draw/stalemate
      }
    },
  });

  // Initialize Stockfish AI
  const {
    isReady: aiReady,
    isThinking,
    getBestMove,
    setSkillLevel,
  } = useStockfish({
    skillLevel: DIFFICULTY_TO_SKILL_LEVEL[settings.aiConfig.difficulty],
    thinkTimeMs: settings.aiConfig.thinkTimeMs,
  });

  // Load saved game on mount
  useEffect(() => {
    const savedFen = localStorage.getItem(CHESS_GAME_FEN_KEY);
    if (savedFen && savedFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      loadFen(savedFen);
    }
  }, [loadFen]);

  // Auto-save game position
  useEffect(() => {
    if (settings.autoSave) {
      localStorage.setItem(CHESS_GAME_FEN_KEY, fen);
    }
  }, [fen, settings.autoSave]);

  // Update AI skill level when difficulty changes
  useEffect(() => {
    setSkillLevel(DIFFICULTY_TO_SKILL_LEVEL[settings.aiConfig.difficulty]);
  }, [settings.aiConfig.difficulty, setSkillLevel]);

  // Inactivity hint timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastMoveTimeRef.current > 30000 && !showHint && turn === 'w' && !isGameOver) {
        setShowHint(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [showHint, turn, isGameOver]);

  // Handle player move
  const handleMove = useCallback(
    (move: { from: string; to: string; promotion?: string }): boolean => {
      // Only allow moves when it's player's turn (white) and AI is not thinking
      if (turn !== 'w' || isThinking) return false;

      const madeMove = makeMove(move);
      if (madeMove) {
        setLastMove({ from: move.from, to: move.to });
        setShowHint(false);
        lastMoveTimeRef.current = Date.now();
        return true;
      }
      return false;
    },
    [turn, isThinking, makeMove]
  );

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (turn === 'b' && aiReady && !isGameOver && !isThinking) {
      const makeAIMove = async () => {
        const aiMoveStr = await getBestMove(fen);
        if (aiMoveStr) {
          // Parse UCI move format (e.g., "e7e5" or "e7e8q")
          const from = aiMoveStr.slice(0, 2);
          const to = aiMoveStr.slice(2, 4);
          const promotion = aiMoveStr.length > 4 ? aiMoveStr[4] : undefined;

          const madeMove = makeMove({ from, to, promotion });
          if (madeMove) {
            setLastMove({ from, to });
          }
        }
      };
      makeAIMove();
    }
  }, [turn, aiReady, isGameOver, isThinking, fen, getBestMove, makeMove]);

  // Handle difficulty change
  const handleDifficultyChange = (difficulty: AIDifficulty) => {
    onSettingsChange({
      aiConfig: {
        ...settings.aiConfig,
        difficulty,
        skillLevel: DIFFICULTY_TO_SKILL_LEVEL[difficulty],
      },
    });
  };

  // Handle new game
  const handleNewGame = () => {
    reset();
    setLastMove(null);
    setPlayerWon(null);
    setShowHint(false);
    lastMoveTimeRef.current = Date.now();
    localStorage.removeItem(CHESS_GAME_FEN_KEY);
  };

  // Handle undo (undo both player and AI move)
  const handleUndo = () => {
    // Undo AI move
    undo();
    // Undo player move
    undo();
    setLastMove(null);
  };

  // Handle resign
  const handleResign = () => {
    setPlayerWon(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: smoothOut }}
      className="flex-1 flex flex-col lg:flex-row gap-6"
    >
      {/* Left: Chess Board */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* AI Loading State */}
        {!aiReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'mb-4 flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-primary/10 border border-primary/20'
            )}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-4 h-4 text-primary" strokeWidth={2} />
            </motion.div>
            <span className="text-sm text-primary">Loading AI opponent...</span>
          </motion.div>
        )}

        {/* Board container */}
        <div className="relative w-full max-w-[480px] aspect-square">
          <ChessBoard
            fen={fen}
            onMove={handleMove}
            orientation="white"
            showLegalMoves={settings.showHints}
            getLegalMoves={getLegalMoves}
            disabled={turn !== 'w' || isThinking || isGameOver}
            lastMove={lastMove ?? undefined}
          />

          {/* Game result overlay */}
          <AnimatePresence>
            {(isGameOver || playerWon === false) && result && (
              <GameResultBanner
                result={playerWon === false ? 'resignation' : result}
                playerWon={playerWon}
                onNewGame={handleNewGame}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Inactivity hint */}
        <AnimatePresence>
          {showHint && !isGameOver && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.7, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 text-sm text-muted-foreground/70"
            >
              Take your time...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Controls and History */}
      <div className="lg:w-72 flex flex-col gap-4">
        {/* Game Controls */}
        <GameControls
          difficulty={settings.aiConfig.difficulty}
          onDifficultyChange={handleDifficultyChange}
          onNewGame={handleNewGame}
          onUndo={handleUndo}
          onResign={handleResign}
          canUndo={history.length >= 2}
          isGameOver={isGameOver || playerWon === false}
          isThinking={isThinking}
        />

        {/* Move History */}
        {settings.showMoveHistory && (
          <MoveHistory history={history} maxHeight="240px" />
        )}

        {/* Learn Mode */}
        <LearnModeExplanation
          title="Playing Against Stockfish"
          description="Stockfish is one of the strongest chess engines. The difficulty setting adjusts its Skill Level."
          details="Beginner mode (Skill Level 2) makes obvious mistakes. Maximum (Skill Level 20) plays near-perfect chess. The AI thinks for about 1 second per move."
          type="info"
        />
      </div>
    </motion.div>
  );
}

/**
 * Chess Page - Inner content with tutoring overlays
 */
function ChessContent() {
  // Load settings from localStorage
  const [settings, setSettings] = useState<ChessSettings>(() => {
    try {
      const saved = localStorage.getItem(CHESS_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_CHESS_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CHESS_SETTINGS;
  });

  // Get ring energy from tutoring context for UI integration
  const ringEnergy = useRingLessonEnergy();

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(CHESS_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Handle settings change
  const handleSettingsChange = (updates: Partial<ChessSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  // Handle mode change
  const handleModeChange = (mode: ChessMode) => {
    setSettings((prev) => ({ ...prev, mode }));
  };

  return (
    <div className="page h-full flex flex-col relative">
      {/* Header with optional ring energy indicator */}
      <motion.div
        className="shrink-0 mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg transition-colors duration-300',
                ringEnergy > 0.5 ? 'bg-primary/20' : 'bg-primary/10'
              )}
              style={{
                boxShadow: ringEnergy > 0.3 ? `0 0 ${ringEnergy * 15}px rgba(168, 85, 247, ${ringEnergy * 0.4})` : 'none',
              }}
            >
              <Crown className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Chess
            </h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/70 ml-12">
          Ambient chess experience - take your time, no pressure
        </p>
      </motion.div>

      {/* Mode Tabs */}
      <motion.div
        className="shrink-0 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={cn(
          'inline-flex p-1 rounded-xl',
          'glass',
          'border border-white/[0.06]'
        )}>
          {modeTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = settings.mode === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => handleModeChange(tab.id)}
                disabled={!tab.available && tab.id !== 'casual'}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-lg',
                  'text-sm font-medium',
                  isActive && 'text-primary',
                  !isActive && tab.available && 'text-muted-foreground',
                  !tab.available && tab.id !== 'casual' && 'text-muted-foreground/40 cursor-not-allowed'
                )}
                whileHover={tab.available ? { scale: 1.02 } : undefined}
                whileTap={tab.available ? { scale: 0.98 } : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="chessModeTab"
                    className={cn(
                      'absolute inset-0 rounded-lg',
                      'bg-primary/10 border border-primary/30'
                    )}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  {tab.label}
                  {!tab.available && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground/60">
                      Soon
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Mode Content */}
      <AnimatePresence mode="wait">
        {settings.mode === 'casual' && (
          <CasualMode
            key="casual"
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />
        )}
        {settings.mode === 'puzzle' && (
          <ComingSoonMode key="puzzle" mode="puzzle" />
        )}
        {settings.mode === 'analysis' && (
          <ComingSoonMode key="analysis" mode="analysis" />
        )}
      </AnimatePresence>

      {/* Lesson overlay - shows ring-synchronized hints during tutoring */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <LessonOverlay position="top" />
      </div>

      {/* Celebration burst - shows on successful moves during tutoring */}
      <CongratulationBurst />
    </div>
  );
}

/**
 * Chess Page - Main component wrapped with RingLessonProvider
 *
 * The RingLessonProvider enables tutoring features:
 * - Ring state synchronization with lesson progress
 * - Celebration effects on correct moves
 * - Hint overlays during lessons
 */
function Chess() {
  return (
    <RingLessonProvider>
      <ChessContent />
    </RingLessonProvider>
  );
}

export default Chess;
