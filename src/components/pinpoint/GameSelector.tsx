import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useGames } from '../../hooks/useGames';
import type { OptimizationGoal } from './GoalSelector';
import type { DetectedGame } from '../../types/games';
import { Loader2, Gamepad2, Search, FolderOpen } from 'lucide-react';

interface GameSelectorProps {
  goal: OptimizationGoal;
  onSelect: (game: DetectedGame) => void;
}

/**
 * GameSelector - Second step in the Pinpoint wizard.
 *
 * Shows detected games and allows the user to select one for optimization.
 * Includes search filtering.
 */
export function GameSelector({ goal, onSelect }: GameSelectorProps) {
  const { games, loading, error } = useGames();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter games by search query
  const filteredGames = games.filter((game) =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get launcher badge color
  const getLauncherColor = (launcher: string) => {
    switch (launcher.toLowerCase()) {
      case 'steam':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'epic':
        return 'bg-muted text-muted-foreground border-border/30';
      case 'gog':
        return 'bg-accent/15 text-accent border-accent/30';
      default:
        return 'bg-muted text-muted-foreground border-border/30';
    }
  };

  // Format file size
  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-2">Select a Game</h2>
      <p className="text-muted-foreground mb-6">
        Choose which game to optimize for{' '}
        <span className="text-primary font-medium">{goal.label}</span>
      </p>

      {/* Search input */}
      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          type="text"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-11 pr-4 py-3 rounded-xl',
            'bg-white/[0.02] border border-white/[0.04]',
            'text-sm text-foreground placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <motion.div
          className="flex flex-col items-center justify-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Detecting installed games...</p>
        </motion.div>
      )}

      {/* Error state */}
      {error && !loading && (
        <motion.div
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-[#05030a]/80 backdrop-blur-xl border border-danger/30 mb-4">
            <Gamepad2 className="w-7 h-7 text-danger" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Detection Error</h3>
          <p className="text-sm text-muted-foreground/70 max-w-sm">{error}</p>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredGames.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-16 h-16 flex items-center justify-center rounded-full bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06] mb-6"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <FolderOpen className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
          </motion.div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'No games found' : 'No games detected'}
          </h3>
          <p className="text-sm text-muted-foreground/70 max-w-sm">
            {searchQuery
              ? `No games match "${searchQuery}". Try a different search.`
              : 'Make sure you have games installed via Steam, Epic, or GOG.'}
          </p>
        </motion.div>
      )}

      {/* Games list */}
      {!loading && !error && filteredGames.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          {filteredGames.map((game, index) => (
            <motion.button
              key={game.id}
              onClick={() => onSelect(game)}
              className={cn(
                'w-full rounded-xl p-4 text-left bg-white/[0.02]',
                'border border-white/[0.04]',
                'group relative overflow-hidden',
                'hover:border-primary/30 transition-colors duration-200'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              whileHover={{
                y: -2,
                boxShadow: '0 0 16px -8px hsl(var(--glow-primary)/0.3)',
              }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* Game name */}
                  <h4 className="font-medium text-foreground group-hover:text-primary transition-colors truncate pr-4">
                    {game.name}
                  </h4>

                  {/* Game details */}
                  <div className="flex items-center gap-2 mt-1">
                    {/* Launcher badge */}
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider',
                        'border',
                        getLauncherColor(game.launcher)
                      )}
                    >
                      {game.launcher}
                    </span>

                    {/* Size */}
                    {game.size_bytes && (
                      <span className="text-xs text-muted-foreground">
                        {formatSize(game.size_bytes)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Select indicator */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'bg-primary/10 border border-primary/20',
                    'opacity-0 group-hover:opacity-100 transition-opacity'
                  )}
                >
                  <Gamepad2 className="w-4 h-4 text-primary" strokeWidth={1.75} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default GameSelector;
