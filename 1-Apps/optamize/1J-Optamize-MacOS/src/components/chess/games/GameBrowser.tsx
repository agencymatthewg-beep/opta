/**
 * GameBrowser - Browse and filter imported chess games.
 *
 * Features:
 * - Filter by result, time control, platform
 * - Search by opponent name
 * - Sort by date, rating
 * - Connect accounts and import games
 * - PGN file upload
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Upload,
  Link2,
  Trophy,
  XCircle,
  Minus,
  Zap,
  Timer,
  Clock,
  ChevronDown,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameArchive } from '@/hooks/useGameArchive';
import { GameCard } from './GameCard';
import type {
  ArchivedGame,
  GameFilter,
  GameSort,
  GameSource,
  GameResult,
  TimeControlCategory,
} from '@/types/gameArchive';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface GameBrowserProps {
  /** Callback when a game is selected for review */
  onSelectGame?: (game: ArchivedGame) => void;
  /** Currently selected game ID */
  selectedGameId?: string;
  /** Maximum height for scroll container */
  maxHeight?: string;
}

/**
 * Filter chip button.
 */
function FilterChip({
  label,
  isActive,
  onClick,
  icon: Icon,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
        'border transition-colors',
        isActive
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-white/5 text-muted-foreground/70 border-white/[0.08] hover:border-white/[0.15]'
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
      {label}
    </motion.button>
  );
}

/**
 * Connect account modal/dropdown.
 */
function ConnectAccountPanel({
  source,
  onConnect,
  onCancel,
  isLoading,
  error,
}: {
  source: GameSource;
  onConnect: (username: string) => Promise<boolean>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    const success = await onConnect(username.trim());
    if (success) {
      onCancel();
    }
  };

  const platformName = source === 'chess.com' ? 'Chess.com' : 'Lichess';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: smoothOut }}
      className={cn(
        'p-4 rounded-xl',
        'glass',
        'border border-white/[0.08]'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-foreground">
          Connect {platformName}
        </h4>
        <button
          onClick={onCancel}
          className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={`Enter your ${platformName} username`}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm',
            'bg-black/20 border border-white/[0.08]',
            'text-foreground placeholder:text-muted-foreground/40',
            'focus:outline-none focus:ring-2 focus:ring-primary/50'
          )}
          disabled={isLoading}
        />

        {error && (
          <p className="mt-2 text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              'text-muted-foreground/70 hover:text-muted-foreground',
              'hover:bg-white/5 transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!username.trim() || isLoading}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-primary/20 text-primary border border-primary/30',
              'hover:bg-primary/30 transition-colors',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

/**
 * GameBrowser component.
 */
export function GameBrowser({
  onSelectGame,
  selectedGameId,
  maxHeight = '400px',
}: GameBrowserProps) {
  const {
    games,
    connectedAccounts,
    isImporting,
    error,
    connectChessCom,
    connectLichess,
    disconnect: _disconnect,
    importFromSource,
    importFromFile,
    getFilteredGames,
    getStats,
  } = useGameArchive();

  // Filter state
  const [filter, setFilter] = useState<GameFilter>({});
  const [sort] = useState<GameSort>({
    field: 'playedAt',
    direction: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [connectingSource, setConnectingSource] = useState<GameSource | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply search to filter
  const effectiveFilter: GameFilter = useMemo(
    () => ({
      ...filter,
      opponent: searchQuery || undefined,
    }),
    [filter, searchQuery]
  );

  const filteredGames = useMemo(
    () => getFilteredGames(effectiveFilter, sort),
    [getFilteredGames, effectiveFilter, sort]
  );

  const stats = useMemo(() => getStats(), [getStats]);

  /**
   * Handle result filter toggle.
   */
  const toggleResultFilter = useCallback((result: GameResult) => {
    setFilter((prev) => ({
      ...prev,
      result: prev.result === result ? undefined : result,
    }));
  }, []);

  /**
   * Handle category filter toggle.
   */
  const toggleCategoryFilter = useCallback((category: TimeControlCategory) => {
    setFilter((prev) => ({
      ...prev,
      category: prev.category === category ? undefined : category,
    }));
  }, []);

  /**
   * Handle connect account.
   */
  const handleConnect = useCallback(
    async (source: GameSource, username: string): Promise<boolean> => {
      if (source === 'chess.com') {
        return connectChessCom(username);
      } else if (source === 'lichess') {
        return connectLichess(username);
      }
      return false;
    },
    [connectChessCom, connectLichess]
  );

  /**
   * Handle import from source.
   */
  const handleImport = useCallback(
    async (source: GameSource) => {
      await importFromSource(source);
    },
    [importFromSource]
  );

  /**
   * Handle file upload.
   */
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await importFromFile(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [importFromFile]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and actions */}
      <div className="shrink-0 space-y-3 mb-4">
        {/* Search bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opponent..."
            className={cn(
              'w-full pl-9 pr-4 py-2.5 rounded-lg text-sm',
              'bg-black/20 border border-white/[0.08]',
              'text-foreground placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
              'border transition-colors',
              showFilters
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-white/5 text-muted-foreground/70 border-white/[0.08] hover:border-white/[0.15]'
            )}
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
            Filters
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform',
                showFilters && 'rotate-180'
              )}
              strokeWidth={2}
            />
          </motion.button>

          <div className="flex-1" />

          {/* Import buttons */}
          {connectedAccounts['chess.com'] && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleImport('chess.com')}
              disabled={isImporting}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium',
                'bg-white/5 text-muted-foreground/70 border border-white/[0.08]',
                'hover:border-white/[0.15] transition-colors',
                'disabled:opacity-50'
              )}
            >
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              setConnectingSource(
                connectedAccounts['chess.com'] ? null : 'chess.com'
              )
            }
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium',
              'border transition-colors',
              connectedAccounts['chess.com']
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-white/5 text-muted-foreground/70 border-white/[0.08] hover:border-white/[0.15]'
            )}
            title={
              connectedAccounts['chess.com']
                ? `Connected: ${connectedAccounts['chess.com']}`
                : 'Connect Chess.com'
            }
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            Chess.com
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              setConnectingSource(connectedAccounts.lichess ? null : 'lichess')
            }
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium',
              'border transition-colors',
              connectedAccounts.lichess
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-white/5 text-muted-foreground/70 border-white/[0.08] hover:border-white/[0.15]'
            )}
            title={
              connectedAccounts.lichess
                ? `Connected: ${connectedAccounts.lichess}`
                : 'Connect Lichess'
            }
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            Lichess
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium',
              'bg-white/5 text-muted-foreground/70 border border-white/[0.08]',
              'hover:border-white/[0.15] transition-colors'
            )}
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
            PGN
          </motion.button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Connect account panel */}
        <AnimatePresence>
          {connectingSource && (
            <ConnectAccountPanel
              source={connectingSource}
              onConnect={(username) => handleConnect(connectingSource, username)}
              onCancel={() => setConnectingSource(null)}
              isLoading={isImporting}
              error={error}
            />
          )}
        </AnimatePresence>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: smoothOut }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-2">
                {/* Result filters */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 w-14">
                    Result
                  </span>
                  <FilterChip
                    label="Win"
                    icon={Trophy}
                    isActive={filter.result === 'win'}
                    onClick={() => toggleResultFilter('win')}
                  />
                  <FilterChip
                    label="Loss"
                    icon={XCircle}
                    isActive={filter.result === 'loss'}
                    onClick={() => toggleResultFilter('loss')}
                  />
                  <FilterChip
                    label="Draw"
                    icon={Minus}
                    isActive={filter.result === 'draw'}
                    onClick={() => toggleResultFilter('draw')}
                  />
                </div>

                {/* Time control filters */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 w-14">
                    Time
                  </span>
                  <FilterChip
                    label="Bullet"
                    icon={Zap}
                    isActive={filter.category === 'bullet'}
                    onClick={() => toggleCategoryFilter('bullet')}
                  />
                  <FilterChip
                    label="Blitz"
                    icon={Timer}
                    isActive={filter.category === 'blitz'}
                    onClick={() => toggleCategoryFilter('blitz')}
                  />
                  <FilterChip
                    label="Rapid"
                    icon={Clock}
                    isActive={filter.category === 'rapid'}
                    onClick={() => toggleCategoryFilter('rapid')}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats bar */}
      {games.length > 0 && (
        <div className="shrink-0 flex items-center gap-4 mb-3 text-xs text-muted-foreground/60">
          <span>
            {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-success">{stats.wins}W</span>
          <span className="text-danger">{stats.losses}L</span>
          <span>{stats.draws}D</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{stats.winRate.toFixed(0)}% WR</span>
        </div>
      )}

      {/* Game list */}
      <div
        className="flex-1 overflow-y-auto space-y-2 pr-1"
        style={{ maxHeight }}
      >
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Download
              className="w-12 h-12 text-muted-foreground/20 mb-4"
              strokeWidth={1}
            />
            <h4 className="text-sm font-medium text-muted-foreground/60 mb-2">
              No games yet
            </h4>
            <p className="text-xs text-muted-foreground/40 max-w-[200px]">
              Connect your Chess.com or Lichess account, or import a PGN file to
              get started.
            </p>
          </div>
        ) : (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => onSelectGame?.(game)}
              isSelected={game.id === selectedGameId}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default GameBrowser;
