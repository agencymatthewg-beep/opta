import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGames } from '../hooks/useGames';
import { useUserProfile } from '../hooks/useUserProfile';
import GameList from '../components/GameList';
import GameOptimizationPreview from '../components/GameOptimizationPreview';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DetectedGame, GameOptimization } from '../types/games';
import type { Recommendation } from '../types/profile';
import { Gamepad2, RefreshCw, X, AlertCircle, Play, FolderOpen, Hash } from 'lucide-react';

// Steam app IDs that have optimizations in the database
const GAMES_WITH_OPTIMIZATIONS = new Set([
  'steam_730',    // CS2
  'steam_570',    // Dota 2
  'steam_1245620', // Elden Ring
  'steam_271590',  // GTA V
  'steam_1091500', // Cyberpunk 2077
  'steam_1172470', // Apex Legends
  'steam_578080',  // PUBG
  'steam_1599340', // Lost Ark
  'steam_252490',  // Rust
  'steam_892970',  // Valheim
]);

/**
 * Format file size from bytes to human-readable string.
 */
function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '--';

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Launcher display configuration.
 */
const LAUNCHER_DISPLAY = {
  steam: {
    name: 'Steam',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
  },
  epic: {
    name: 'Epic Games',
    color: 'text-slate-300',
    bgColor: 'bg-slate-400/15',
    borderColor: 'border-slate-400/30',
  },
  gog: {
    name: 'GOG Galaxy',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
  },
} as const;

type LauncherId = keyof typeof LAUNCHER_DISPLAY;

/**
 * Detail panel for the selected game.
 */
function GameDetailPanel({
  game,
  optimization,
  loadingOptimization,
  onClose,
  onRequestAI,
  recommendations,
  loadingRecommendations,
  onApplyRecommendation,
  onDismissRecommendation,
}: {
  game: DetectedGame;
  optimization: GameOptimization | null;
  loadingOptimization: boolean;
  onClose: () => void;
  onRequestAI: () => void;
  recommendations: Recommendation[];
  loadingRecommendations: boolean;
  onApplyRecommendation: (recommendation: Recommendation) => void;
  onDismissRecommendation: (recommendationId: string) => void;
}) {
  const launcherId = game.launcher.toLowerCase() as LauncherId;
  const launcher = LAUNCHER_DISPLAY[launcherId] || LAUNCHER_DISPLAY.steam;

  return (
    <motion.div
      className="h-full flex flex-col"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground truncate">
              {game.name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                launcher.bgColor,
                launcher.color,
                'border',
                launcher.borderColor
              )}>
                {launcher.name}
              </span>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0 glass-subtle rounded-xl h-9 w-9"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
              <span className="sr-only">Close</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Game Info Card */}
          <motion.div
            className="glass-subtle rounded-xl border border-border/20 overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="px-4 py-3 border-b border-border/20">
              <h4 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
                Game Information
              </h4>
            </div>
            <div className="p-4 space-y-4">
              {/* Install Path */}
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mb-1.5">
                  <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Install Location
                </div>
                <code className="text-xs text-foreground/80 glass-subtle px-3 py-1.5 rounded-lg block truncate border border-border/20" title={game.install_path}>
                  {game.install_path}
                </code>
              </div>

              {/* Size */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/60">
                  Install Size
                </span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {formatSize(game.size_bytes)}
                </span>
              </div>

              {/* Game ID */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <Hash className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Game ID
                </div>
                <code className="text-xs text-foreground/60 glass-subtle px-2 py-0.5 rounded-lg border border-border/20">
                  {game.id}
                </code>
              </div>
            </div>
          </motion.div>

          {/* Personalized Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <PersonalizedRecommendations
              recommendations={recommendations}
              loading={loadingRecommendations}
              onApply={onApplyRecommendation}
              onDismiss={onDismissRecommendation}
            />
          </motion.div>

          {/* Optimization Preview */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GameOptimizationPreview
              optimization={optimization}
              loading={loadingOptimization}
              onRequestAI={onRequestAI}
              gameId={game.id.replace('steam_', '')}
              gameName={game.name}
            />
          </motion.div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

/**
 * Empty state for the detail panel when no game is selected.
 */
function EmptyDetailPanel() {
  return (
    <motion.div
      className="h-full flex flex-col items-center justify-center p-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={cn(
          'w-20 h-20 flex items-center justify-center rounded-full mb-6',
          'glass border border-border/30'
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Play className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
      </motion.div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        Select a Game
      </h3>
      <p className="text-sm text-muted-foreground/70 max-w-[240px]">
        Choose a game from the list to view its details and optimization settings.
      </p>
    </motion.div>
  );
}

/**
 * Games - Game profile management page.
 */
function Games() {
  const {
    games,
    launchers,
    totalGames,
    loading,
    error,
    refresh,
    refreshing,
    lastUpdated,
    getGameOptimization,
  } = useGames();

  const { getRecommendations } = useUserProfile();

  const [selectedGame, setSelectedGame] = useState<DetectedGame | null>(null);
  const [loadingOptimization, setLoadingOptimization] = useState(false);
  const [optimization, setOptimization] = useState<GameOptimization | null>(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(new Set());

  // Set of game IDs that have optimizations available
  const gamesWithOptimizations = useMemo(() => {
    return GAMES_WITH_OPTIMIZATIONS;
  }, []);

  // Load optimization and recommendations when game is selected
  useEffect(() => {
    if (!selectedGame) {
      setOptimization(null);
      setRecommendations([]);
      return;
    }

    let cancelled = false;

    const loadOptimization = async () => {
      setLoadingOptimization(true);
      try {
        // Extract Steam app ID from game ID (e.g., "steam_730" -> "730")
        const gameId = selectedGame.id.replace('steam_', '');
        const opt = await getGameOptimization(gameId);
        if (!cancelled) {
          // Only set if we got real optimization data (not generic)
          setOptimization(opt.source !== 'generic' ? opt : null);
        }
      } catch (e) {
        console.error('Failed to load optimization:', e);
        if (!cancelled) {
          setOptimization(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingOptimization(false);
        }
      }
    };

    const loadRecommendations = async () => {
      setLoadingRecommendations(true);
      try {
        const gameId = selectedGame.id.replace('steam_', '');
        const result = await getRecommendations(gameId, selectedGame.name);
        if (!cancelled) {
          // Filter out dismissed recommendations
          const filteredRecs = result.recommendations.filter(
            (rec) => !dismissedRecommendations.has(rec.id)
          );
          setRecommendations(filteredRecs);
        }
      } catch (e) {
        console.error('Failed to load recommendations:', e);
        if (!cancelled) {
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecommendations(false);
        }
      }
    };

    loadOptimization();
    loadRecommendations();
    return () => { cancelled = true; };
  }, [selectedGame, getGameOptimization, getRecommendations, dismissedRecommendations]);

  // Clear selected game if it's no longer in the list
  useEffect(() => {
    if (selectedGame && !games.find((g) => g.id === selectedGame.id)) {
      setSelectedGame(null);
    }
  }, [games, selectedGame]);

  const handleGameSelect = (game: DetectedGame) => {
    setSelectedGame(game);
  };

  const handleCloseDetail = () => {
    setSelectedGame(null);
  };

  const handleRequestAI = () => {
    // Future: Open AI chat with game context
    console.log('Request AI recommendations for:', selectedGame?.name);
  };

  const handleApplyRecommendation = (recommendation: Recommendation) => {
    // Future: Apply the recommendation setting
    console.log('Apply recommendation:', recommendation);
    // For now, remove from list as if applied
    setRecommendations((prev) => prev.filter((r) => r.id !== recommendation.id));
  };

  const handleDismissRecommendation = (recommendationId: string) => {
    // Add to dismissed set and remove from current list
    setDismissedRecommendations((prev) => new Set([...prev, recommendationId]));
    setRecommendations((prev) => prev.filter((r) => r.id !== recommendationId));
  };

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return null;
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  // Error state
  if (error && !games.length) {
    return (
      <div className="page max-w-6xl">
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Games
          </span>
        </motion.h1>
        <motion.div
          className="glass mt-6 flex flex-col items-center justify-center min-h-[300px] p-12 rounded-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className={cn(
            'w-16 h-16 flex items-center justify-center rounded-full mb-6',
            'bg-danger/10 border-2 border-danger/30',
            'shadow-[0_0_24px_-4px_hsl(var(--danger)/0.4)]'
          )}>
            <AlertCircle className="w-7 h-7 text-danger" strokeWidth={1.75} />
          </div>
          <p className="text-muted-foreground/70 text-center mb-6">{error}</p>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={refresh}
              className={cn(
                'gap-2 rounded-xl px-5',
                'bg-gradient-to-r from-primary to-accent',
                'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
              )}
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Retry
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page h-full flex flex-col">
      {/* Header */}
      <motion.div
        className="shrink-0 mb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gamepad2 className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Games
            </h1>
            {!loading && (
              <span className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                'bg-primary/10 text-primary border border-primary/20'
              )}>
                {totalGames} {totalGames === 1 ? 'game' : 'games'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground/60">
                Updated: {getTimeSinceUpdate()}
              </span>
            )}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={refreshing}
                className="gap-1.5 glass-subtle rounded-xl border-border/30"
              >
                <RefreshCw
                  className={cn(
                    'w-4 h-4',
                    refreshing && 'animate-spin'
                  )}
                  strokeWidth={2}
                />
                {refreshing ? 'Scanning...' : 'Rescan'}
              </Button>
            </motion.div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/70 ml-12">
          Detected games across your launchers
        </p>
      </motion.div>

      {/* Split View Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Game List (Left Panel) */}
        <div
          className={cn(
            'flex-1 min-w-0 overflow-auto',
            selectedGame && 'hidden lg:block lg:flex-[2]'
          )}
        >
          <GameList
            games={games}
            launchers={launchers}
            selectedGameId={selectedGame?.id ?? null}
            onGameSelect={handleGameSelect}
            gamesWithOptimizations={gamesWithOptimizations}
            loading={loading}
          />
        </div>

        {/* Detail Panel (Right Panel) */}
        <motion.div
          className={cn(
            'glass rounded-xl overflow-hidden',
            'border border-border/30',
            'lg:flex-1 lg:max-w-md',
            selectedGame ? 'flex flex-col w-full lg:w-auto' : 'hidden lg:flex lg:flex-col'
          )}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {selectedGame ? (
              <GameDetailPanel
                key={selectedGame.id}
                game={selectedGame}
                optimization={optimization}
                loadingOptimization={loadingOptimization}
                onClose={handleCloseDetail}
                onRequestAI={handleRequestAI}
                recommendations={recommendations}
                loadingRecommendations={loadingRecommendations}
                onApplyRecommendation={handleApplyRecommendation}
                onDismissRecommendation={handleDismissRecommendation}
              />
            ) : (
              <EmptyDetailPanel key="empty" />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default Games;
