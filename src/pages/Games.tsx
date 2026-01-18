import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGames } from '../hooks/useGames';
import { useUserProfile } from '../hooks/useUserProfile';
import { useLauncher } from '../hooks/useLauncher';
import { useLaunchPreferences } from '../hooks/useLaunchPreferences';
import { useStealthModeEstimate } from '../hooks/useStealthModeEstimate';
import { useGameSessionContext } from '../components/GameSessionContext';
import GameList from '../components/GameList';
import GameOptimizationPreview from '../components/GameOptimizationPreview';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import LaunchConfirmationModal from '../components/LaunchConfirmationModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DetectedGame, GameOptimization } from '../types/games';
import type { Recommendation } from '../types/profile';
import type { LaunchConfig } from '../types/launcher';
import { Gamepad2, RefreshCw, X, AlertCircle, Play, FolderOpen, Hash, ChevronLeft } from 'lucide-react';
import { LearnModeExplanation } from '../components/LearnModeExplanation';
import { useOptaTextZone } from '../components/OptaTextZoneContext';
import {
  GpuPipelineViz,
  BeforeAfterDiff,
  ImpactPrediction,
} from '../components/visualizations';

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
 * Uses semantic CSS variables per DESIGN_SYSTEM.md.
 */
const LAUNCHER_DISPLAY = {
  steam: {
    name: 'Steam',
    color: 'text-primary',
    bgColor: 'bg-primary/15',
    borderColor: 'border-primary/30',
  },
  epic: {
    name: 'Epic Games',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/15',
    borderColor: 'border-border',
  },
  gog: {
    name: 'GOG Galaxy',
    color: 'text-accent',
    bgColor: 'bg-accent/15',
    borderColor: 'border-accent/30',
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
        {/* Mobile back button - visible only on mobile */}
        <motion.div
          className="lg:hidden mb-3"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1 -ml-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            Back to Games
          </Button>
        </motion.div>

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
              className="shrink-0 rounded-xl h-9 w-9 bg-white/[0.02] border border-white/[0.04]"
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
            className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.04]"
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
                <code className="text-xs text-foreground/80 px-3 py-1.5 rounded-lg block truncate bg-white/[0.02] border border-white/[0.04]" title={game.install_path}>
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
                <code className="text-xs text-foreground/60 px-2 py-0.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
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
            {loadingRecommendations ? (
              <div className="rounded-xl p-4 glass border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-5 rounded bg-muted/30 animate-shimmer" />
                  <div className="h-4 w-32 rounded bg-muted/30 animate-shimmer" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-lg p-4 animate-pulse bg-white/[0.02] border border-white/[0.04]">
                      <div className="h-4 bg-muted/20 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted/20 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <PersonalizedRecommendations
                recommendations={recommendations}
                loading={loadingRecommendations}
                onApply={onApplyRecommendation}
                onDismiss={onDismissRecommendation}
              />
            )}
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

          {/* Learn Mode Visualizations */}
          <GpuPipelineViz
            resolution={{ before: '1440p', after: '1080p' }}
            quality={{ before: 'Ultra', after: 'High' }}
            showComparison
          />

          <BeforeAfterDiff
            changes={[
              { name: 'Resolution Scale', before: '100%', after: '75%', impact: 'positive', fpsGain: 15, qualityLoss: 'minor' },
              { name: 'Shadow Quality', before: 'Ultra', after: 'High', impact: 'positive', fpsGain: 8, qualityLoss: 'minor' },
              { name: 'Anti-Aliasing', before: 'TAA', after: 'FXAA', impact: 'positive', fpsGain: 5, qualityLoss: 'moderate' },
            ]}
            totalFpsGain={28}
          />

          <ImpactPrediction
            predictedFps={{ before: 60, after: 85 }}
            predictedQuality={{ before: 100, after: 85 }}
            predictedThermal={{ before: 82, after: 75 }}
            predictedLoadTime={{ before: 12, after: 10 }}
            confidence="medium"
          />
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
          'glass-subtle border border-white/[0.06]'
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
  const { launchGame, launching, launchingGame, clearError } = useLauncher();
  const { getConfigForGame, setGameOverride } = useLaunchPreferences();
  const { safeToKillCount, estimatedMemorySavingsMb, refresh: refreshStealthEstimate } = useStealthModeEstimate();
  const { session, startSession, handleStealthModeResult, setOptimizationsApplied } = useGameSessionContext();
  const { setMessage, showSuccess, clear: clearTextZone } = useOptaTextZone();

  const [selectedGame, setSelectedGame] = useState<DetectedGame | null>(null);
  const [closingGame, setClosingGame] = useState<DetectedGame | null>(null);
  const [loadingOptimization, setLoadingOptimization] = useState(false);
  const [optimization, setOptimization] = useState<GameOptimization | null>(null);

  // Launch modal state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [gameToLaunch, setGameToLaunch] = useState<DetectedGame | null>(null);
  const [gameOptimizationForLaunch, setGameOptimizationForLaunch] = useState<GameOptimization | null>(null);
  const [launchInitialConfig, setLaunchInitialConfig] = useState<LaunchConfig | null>(null);

  // Recommendations state with localStorage persistence
  const DISMISSED_RECOMMENDATIONS_KEY = 'opta-dismissed-recommendations';
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_RECOMMENDATIONS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist dismissed recommendations to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_RECOMMENDATIONS_KEY, JSON.stringify([...dismissedRecommendations]));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [dismissedRecommendations]);

  // Retry loading state for error recovery
  const [retryLoading, setRetryLoading] = useState(false);

  // Handle retry with proper loading state management
  const handleRetry = async () => {
    setRetryLoading(true);
    try {
      await refresh();
    } catch {
      // Error already handled by useGames hook
    } finally {
      setRetryLoading(false); // Always reset loading state
    }
  };

  // Set of game IDs that have optimizations available
  const gamesWithOptimizations = useMemo(() => {
    return GAMES_WITH_OPTIMIZATIONS;
  }, []);

  // Load optimization and recommendations when game is selected
  useEffect(() => {
    if (!selectedGame) {
      setOptimization(null);
      setRecommendations([]);
      clearTextZone();
      return;
    }

    let cancelled = false;

    // Update text zone when selecting a game
    setMessage(`Analyzing ${selectedGame.name}...`);

    const loadOptimization = async () => {
      setLoadingOptimization(true);
      try {
        // Extract Steam app ID from game ID (e.g., "steam_730" -> "730")
        const gameId = selectedGame.id.replace('steam_', '');
        const opt = await getGameOptimization(gameId);
        if (!cancelled) {
          // Only set if we got real optimization data (not generic)
          const hasOptimizations = opt.source !== 'generic';
          setOptimization(hasOptimizations ? opt : null);

          // Update text zone with results
          if (hasOptimizations && opt.settings) {
            const optimizationCount = Object.keys(opt.settings).length;
            showSuccess(`Found ${optimizationCount} optimizations`, {
              direction: 'up',
              value: String(optimizationCount),
              label: 'settings to apply',
            });
          } else {
            setMessage(`${selectedGame.name} selected`, 'neutral', 'No optimizations available yet');
          }
        }
      } catch (e) {
        console.error('Failed to load optimization:', e);
        if (!cancelled) {
          setOptimization(null);
          setMessage(`${selectedGame.name} selected`, 'neutral', 'Could not load optimizations');
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
  }, [selectedGame, getGameOptimization, getRecommendations, dismissedRecommendations, setMessage, showSuccess, clearTextZone]);

  // Clear selected game if it's no longer in the list (with exit animation)
  useEffect(() => {
    if (selectedGame && !games.find((g) => g.id === selectedGame.id)) {
      // Keep the game for exit animation, then clear after animation completes
      setClosingGame(selectedGame);
      setSelectedGame(null);
      // Clear closingGame after animation duration (300ms)
      const timer = setTimeout(() => {
        setClosingGame(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [games, selectedGame]);

  // Read game ID from URL params on mount and select the game
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    if (gameId && games.length > 0 && !selectedGame) {
      const game = games.find(g => g.id === gameId);
      if (game) setSelectedGame(game);
    }
  }, [games, selectedGame]);

  // Update URL when game selection changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedGame) {
      url.searchParams.set('game', selectedGame.id);
    } else {
      url.searchParams.delete('game');
    }
    window.history.replaceState({}, '', url.toString());
  }, [selectedGame]);

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

  // Launch via Opta handlers
  const handlePlayClick = async (game: DetectedGame) => {
    setGameToLaunch(game);
    clearError();

    // Load saved preferences for this game
    const savedConfig = getConfigForGame(game.id);
    setLaunchInitialConfig(savedConfig);

    // Refresh stealth mode estimates for accurate data
    refreshStealthEstimate();

    // Load optimization for this game to show pending count in modal
    try {
      const gameId = game.id.replace('steam_', '');
      const opt = await getGameOptimization(gameId);
      setGameOptimizationForLaunch(opt.source !== 'generic' ? opt : null);
    } catch {
      setGameOptimizationForLaunch(null);
    }

    setShowLaunchModal(true);
  };

  const handleCloseLaunchModal = () => {
    setShowLaunchModal(false);
    setGameToLaunch(null);
    setGameOptimizationForLaunch(null);
  };

  const handleLaunch = async (config: LaunchConfig) => {
    if (!gameToLaunch) return;

    const result = await launchGame(gameToLaunch, config, {
      // Pass stealth mode result to session tracking
      onStealthModeComplete: (stealthResult) => {
        handleStealthModeResult(stealthResult);
      },
      // Pass optimization count to session tracking
      onOptimizationsApplied: (count) => {
        setOptimizationsApplied(count);
      },
    });

    if (result.success) {
      // Save launch preferences for this game
      setGameOverride(gameToLaunch.id, config);

      handleCloseLaunchModal();
      // Start session tracking if track session is enabled
      if (config.trackSession) {
        startSession(gameToLaunch, config);
      }
    }
    // If failed, modal stays open and shows error state via launching prop
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
          className="mt-6 flex flex-col items-center justify-center min-h-[300px] p-12 rounded-xl glass border border-white/[0.06]"
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
              onClick={handleRetry}
              disabled={retryLoading}
              className={cn(
                'gap-2 rounded-xl px-5',
                'bg-gradient-to-r from-primary to-accent',
                'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', retryLoading && 'animate-spin')} strokeWidth={2} />
              {retryLoading ? 'Retrying...' : 'Retry'}
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
                className="gap-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
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

        {/* Learn Mode Explanation */}
        <LearnModeExplanation
          title="How Game Detection Works"
          description="Opta scans Steam, Epic Games, and GOG Galaxy libraries to find your installed games automatically."
          details="Reads libraryfolders.vdf (Steam), manifests (Epic), and GOG registry entries. Config files are located in standard game directories. Re-scan to detect newly installed games."
          type="how-it-works"
          className="mt-4"
        />
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
            onPlay={handlePlayClick}
            launchingGameId={launchingGame?.id ?? null}
            playingGameId={session?.gameId ?? null}
          />
        </div>

        {/* Detail Panel (Right Panel) */}
        <motion.div
          className={cn(
            'rounded-xl overflow-hidden glass',
            'border border-white/[0.06]',
            'lg:flex-1 lg:max-w-md',
            (selectedGame || closingGame) ? 'flex flex-col w-full lg:w-auto' : 'hidden lg:flex lg:flex-col'
          )}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {(selectedGame || closingGame) ? (
              <GameDetailPanel
                key={(selectedGame || closingGame)!.id}
                game={(selectedGame || closingGame)!}
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

      {/* Launch Confirmation Modal */}
      {gameToLaunch && (
        <LaunchConfirmationModal
          open={showLaunchModal}
          onClose={handleCloseLaunchModal}
          onLaunch={handleLaunch}
          game={gameToLaunch}
          pendingOptimizations={
            gameOptimizationForLaunch?.settings
              ? Object.keys(gameOptimizationForLaunch.settings).length
              : 0
          }
          estimatedMemorySavingsMb={estimatedMemorySavingsMb}
          safeToKillCount={safeToKillCount}
          loading={launching}
          initialConfig={launchInitialConfig ?? undefined}
        />
      )}
    </div>
  );
}

export default Games;
