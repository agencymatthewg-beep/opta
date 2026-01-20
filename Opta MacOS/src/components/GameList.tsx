/**
 * GameList - The Obsidian Game Grid
 *
 * Game list with obsidian glass styling, search, and filtering.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GameCard from './GameCard';
import type { DetectedGame, LauncherInfo } from '../types/games';
import { Search, X, List, ChevronDown } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Sort options for the game list.
 */
type SortOption = 'name' | 'launcher' | 'size';

/**
 * Filter options for launchers.
 */
type LauncherFilter = 'all' | 'steam' | 'epic' | 'gog';

/**
 * Props for the GameList component.
 */
export interface GameListProps {
  /** List of detected games */
  games: DetectedGame[];
  /** Information about detected launchers */
  launchers: LauncherInfo[];
  /** Currently selected game ID */
  selectedGameId: string | null;
  /** Callback when a game is selected */
  onGameSelect: (game: DetectedGame) => void;
  /** Set of game IDs that have optimizations available */
  gamesWithOptimizations?: Set<string>;
  /** Whether the list is loading */
  loading?: boolean;
  /** Callback when Play button is clicked */
  onPlay?: (game: DetectedGame) => void;
  /** Game ID that is currently launching */
  launchingGameId?: string | null;
  /** Game ID that is currently being played */
  playingGameId?: string | null;
}

/**
 * Search input component with icon.
 */
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
      <input
        type="text"
        placeholder="Search games..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full pl-10 pr-10 py-2.5 rounded-xl',
          // Obsidian subtle glass
          'bg-white/[0.02] border border-white/[0.06]',
          'text-sm text-foreground placeholder:text-muted-foreground/50',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
          'focus:shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)]',
          'transition-all duration-200'
        )}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/10"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </motion.button>
      )}
    </div>
  );
}

/**
 * Launcher filter pills.
 */
function LauncherFilters({
  launchers,
  activeFilter,
  onFilterChange,
}: {
  launchers: LauncherInfo[];
  activeFilter: LauncherFilter;
  onFilterChange: (filter: LauncherFilter) => void;
}) {
  const installedLaunchers = launchers.filter((l) => l.installed);

  return (
    <motion.div
      className="flex flex-wrap gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange('all')}
          className={cn(
            'gap-1.5 rounded-xl transition-all',
            activeFilter === 'all'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-[0_0_16px_-4px_rgba(168,85,247,0.3)]'
              : 'bg-white/[0.02] border border-white/[0.06] hover:bg-primary/[0.05]'
          )}
        >
          <List className="w-3.5 h-3.5" strokeWidth={2} />
          All
        </Button>
      </motion.div>

      {installedLaunchers.map((launcher, index) => (
        <motion.div
          key={launcher.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + index * 0.05 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(launcher.id as LauncherFilter)}
            className={cn(
              'gap-1.5 rounded-xl transition-all',
              activeFilter === launcher.id
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-[0_0_16px_-4px_rgba(168,85,247,0.3)]'
                : 'bg-white/[0.02] border border-white/[0.06] hover:bg-primary/[0.05]'
            )}
          >
            {launcher.name}
            <span className="text-xs text-muted-foreground/60 ml-1">
              {launcher.game_count}
            </span>
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Sort dropdown.
 */
function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground/60">Sort:</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className={cn(
            'appearance-none pl-3 pr-8 py-2 rounded-xl',
            // Obsidian subtle glass
            'bg-white/[0.02] border border-white/[0.06]',
            'text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
            'focus:shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)]',
            'transition-all duration-200',
            'cursor-pointer'
          )}
        >
          <option value="name">Name</option>
          <option value="launcher">Launcher</option>
          <option value="size">Size</option>
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" strokeWidth={2} />
      </div>
    </div>
  );
}

/**
 * Empty state when no games found.
 */
function EmptyState({
  hasLaunchers,
  hasSearch,
  onClearSearch,
}: {
  hasLaunchers: boolean;
  hasSearch: boolean;
  onClearSearch: () => void;
}) {
  if (!hasLaunchers) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 text-center"
        initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
        transition={{ ease: smoothOut }}
      >
        <div className={cn(
          'w-16 h-16 flex items-center justify-center rounded-full mb-6',
          'glass-subtle',
          'border border-white/[0.06]'
        )}>
          <Search className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Launchers Detected</h3>
        <p className="text-sm text-muted-foreground/70 max-w-sm">
          Install Steam, Epic Games, or GOG Galaxy to detect your games automatically.
        </p>
      </motion.div>
    );
  }

  if (hasSearch) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 text-center"
        initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
        transition={{ ease: smoothOut }}
      >
        <div className={cn(
          'w-16 h-16 flex items-center justify-center rounded-full mb-6',
          'glass-subtle',
          'border border-white/[0.06]'
        )}>
          <Search className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Games Found</h3>
        <p className="text-sm text-muted-foreground/70 max-w-sm mb-4">
          No games match your search criteria.
        </p>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="outline" onClick={onClearSearch} className="bg-white/[0.02] border-white/[0.06] rounded-xl">
            Clear Search
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
    >
      <div className={cn(
        'w-16 h-16 flex items-center justify-center rounded-full mb-6',
        'glass-subtle',
        'border border-white/[0.06]'
      )}>
        <Search className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No Games Found</h3>
      <p className="text-sm text-muted-foreground/70 max-w-sm">
        No games were found in your libraries. Make sure your games are installed through a supported launcher.
      </p>
    </motion.div>
  );
}

/**
 * Skeleton loading state for game cards.
 */
function GameCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ delay, ease: smoothOut }}
      className={cn(
        "rounded-xl overflow-hidden",
        "glass",
        "border border-white/[0.06]"
      )}
    >
      <div className="h-1.5 bg-white/[0.04] animate-pulse rounded-t-xl" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="h-5 w-3/4 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-5 w-14 rounded-full bg-white/[0.04] animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * GameList - Grid of game cards with filtering, search, and sorting.
 */
function GameList({
  games,
  launchers,
  selectedGameId,
  onGameSelect,
  gamesWithOptimizations = new Set(),
  loading = false,
  onPlay,
  launchingGameId,
  playingGameId,
}: GameListProps) {
  const [search, setSearch] = useState('');
  const [launcherFilter, setLauncherFilter] = useState<LauncherFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Filter by launcher
    if (launcherFilter !== 'all') {
      result = result.filter(
        (game) => game.launcher.toLowerCase() === launcherFilter
      );
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((game) =>
        game.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'launcher':
          return a.launcher.localeCompare(b.launcher) || a.name.localeCompare(b.name);
        case 'size':
          return (b.size_bytes ?? 0) - (a.size_bytes ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [games, launcherFilter, search, sortBy]);

  const hasInstalledLaunchers = launchers.some((l) => l.installed);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 h-11 rounded-xl bg-muted/30 animate-shimmer" />
          <div className="h-11 w-32 rounded-xl bg-muted/30 animate-shimmer" />
        </div>
        <div className="h-9 rounded-xl bg-muted/30 animate-shimmer w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <GameCardSkeleton key={i} delay={i * 0.05} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} />
        </div>
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </motion.div>

      {/* Launcher Filters */}
      <LauncherFilters
        launchers={launchers}
        activeFilter={launcherFilter}
        onFilterChange={setLauncherFilter}
      />

      {/* Game Grid */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.map((game, index) => (
            <GameCard
              key={game.id}
              game={game}
              hasOptimization={gamesWithOptimizations.has(game.id)}
              onClick={() => onGameSelect(game)}
              onPlay={onPlay ? () => onPlay(game) : undefined}
              isSelected={selectedGameId === game.id}
              isLaunching={launchingGameId === game.id}
              isPlaying={playingGameId === game.id}
              delay={index * 0.03}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          hasLaunchers={hasInstalledLaunchers}
          hasSearch={search.length > 0}
          onClearSearch={() => setSearch('')}
        />
      )}
    </div>
  );
}

export default GameList;
