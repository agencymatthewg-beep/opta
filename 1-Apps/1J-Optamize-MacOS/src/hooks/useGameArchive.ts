/**
 * React hook for game archive management.
 *
 * Features:
 * - Import games from Chess.com and Lichess
 * - Import games from PGN files
 * - Local storage persistence
 * - Filtering and sorting
 * - Connected account management
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  ArchivedGame,
  GameArchiveState,
  GameFilter,
  GameSort,
  GameSource,
} from '../types/gameArchive';
import { DEFAULT_GAME_ARCHIVE_STATE } from '../types/gameArchive';
import { fetchRecentGames, verifyUser } from '../lib/chesscom';
import { fetchLichessGames, verifyLichessUser } from '../lib/lichessGames';
import { parsePGNFile, isValidPGN } from '../lib/pgnParser';

// LocalStorage keys
const GAME_ARCHIVE_KEY = 'opta_game_archive';
const CONNECTED_ACCOUNTS_KEY = 'opta_connected_accounts';

/**
 * Load archive state from localStorage.
 */
function loadArchiveState(): GameArchiveState {
  try {
    const savedGames = localStorage.getItem(GAME_ARCHIVE_KEY);
    const savedAccounts = localStorage.getItem(CONNECTED_ACCOUNTS_KEY);

    const games = savedGames ? JSON.parse(savedGames) : [];
    const accounts = savedAccounts
      ? JSON.parse(savedAccounts)
      : DEFAULT_GAME_ARCHIVE_STATE.connectedAccounts;

    return {
      ...DEFAULT_GAME_ARCHIVE_STATE,
      games,
      connectedAccounts: accounts,
    };
  } catch {
    return DEFAULT_GAME_ARCHIVE_STATE;
  }
}

/**
 * Save games to localStorage.
 */
function saveGames(games: ArchivedGame[]): void {
  try {
    localStorage.setItem(GAME_ARCHIVE_KEY, JSON.stringify(games));
  } catch (error) {
    console.error('Failed to save game archive:', error);
  }
}

/**
 * Save connected accounts to localStorage.
 */
function saveAccounts(accounts: Record<GameSource, string | null>): void {
  try {
    localStorage.setItem(CONNECTED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Failed to save connected accounts:', error);
  }
}

/**
 * Options for useGameArchive hook.
 */
export interface UseGameArchiveOptions {
  /** Auto-load from localStorage on mount */
  autoLoad?: boolean;
}

/**
 * Return type for useGameArchive hook.
 */
export interface UseGameArchiveReturn {
  // State
  /** All archived games */
  games: ArchivedGame[];
  /** Connected usernames per platform */
  connectedAccounts: Record<GameSource, string | null>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Error message */
  error: string | null;

  // Import actions
  /** Connect a Chess.com account */
  connectChessCom: (username: string) => Promise<boolean>;
  /** Connect a Lichess account */
  connectLichess: (username: string) => Promise<boolean>;
  /** Disconnect an account */
  disconnect: (source: GameSource) => void;
  /** Import games from connected account */
  importFromSource: (source: GameSource, limit?: number) => Promise<number>;
  /** Import games from PGN string */
  importFromPGN: (pgn: string, playerUsername?: string) => number;
  /** Import games from PGN file */
  importFromFile: (file: File, playerUsername?: string) => Promise<number>;

  // Game management
  /** Get a single game by ID */
  getGame: (id: string) => ArchivedGame | undefined;
  /** Delete a game */
  deleteGame: (id: string) => void;
  /** Delete all games from a source */
  deleteFromSource: (source: GameSource) => void;
  /** Clear all games */
  clearAll: () => void;

  // Filtering and sorting
  /** Get filtered and sorted games */
  getFilteredGames: (filter?: GameFilter, sort?: GameSort) => ArchivedGame[];
  /** Get game statistics */
  getStats: () => GameArchiveStats;
}

/**
 * Game archive statistics.
 */
export interface GameArchiveStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  bySource: Record<GameSource, number>;
  byCategory: Record<string, number>;
}

/**
 * Hook for managing chess game archives.
 *
 * @param options - Configuration options
 * @returns Archive state and control functions
 */
export function useGameArchive(
  options: UseGameArchiveOptions = {}
): UseGameArchiveReturn {
  const { autoLoad = true } = options;

  // State
  const [state, setState] = useState<GameArchiveState>(() =>
    autoLoad ? loadArchiveState() : DEFAULT_GAME_ARCHIVE_STATE
  );

  // Persist games when changed
  useEffect(() => {
    saveGames(state.games);
  }, [state.games]);

  // Persist accounts when changed
  useEffect(() => {
    saveAccounts(state.connectedAccounts);
  }, [state.connectedAccounts]);

  /**
   * Add games to archive (deduplicating by ID).
   */
  const addGames = useCallback((newGames: ArchivedGame[]) => {
    setState((prev) => {
      const existingIds = new Set(prev.games.map((g) => g.id));
      const uniqueNewGames = newGames.filter((g) => !existingIds.has(g.id));

      return {
        ...prev,
        games: [...prev.games, ...uniqueNewGames].sort(
          (a, b) =>
            new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        ),
      };
    });
  }, []);

  /**
   * Connect a Chess.com account.
   */
  const connectChessCom = useCallback(async (username: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isImporting: true, error: null }));

    try {
      const exists = await verifyUser(username);
      if (!exists) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: `User "${username}" not found on Chess.com`,
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isImporting: false,
        connectedAccounts: {
          ...prev.connectedAccounts,
          'chess.com': username,
        },
      }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isImporting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
      return false;
    }
  }, []);

  /**
   * Connect a Lichess account.
   */
  const connectLichess = useCallback(async (username: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isImporting: true, error: null }));

    try {
      const exists = await verifyLichessUser(username);
      if (!exists) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: `User "${username}" not found on Lichess`,
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isImporting: false,
        connectedAccounts: {
          ...prev.connectedAccounts,
          lichess: username,
        },
      }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isImporting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
      return false;
    }
  }, []);

  /**
   * Disconnect an account.
   */
  const disconnect = useCallback((source: GameSource) => {
    setState((prev) => ({
      ...prev,
      connectedAccounts: {
        ...prev.connectedAccounts,
        [source]: null,
      },
    }));
  }, []);

  /**
   * Import games from a connected source.
   */
  const importFromSource = useCallback(
    async (source: GameSource, limit: number = 50): Promise<number> => {
      const username = state.connectedAccounts[source];
      if (!username) {
        setState((prev) => ({
          ...prev,
          error: `No ${source} account connected`,
        }));
        return 0;
      }

      setState((prev) => ({ ...prev, isImporting: true, error: null }));

      try {
        let games: ArchivedGame[] = [];

        if (source === 'chess.com') {
          games = await fetchRecentGames(username, limit);
        } else if (source === 'lichess') {
          games = await fetchLichessGames(username, limit);
        }

        addGames(games);

        setState((prev) => ({
          ...prev,
          isImporting: false,
          lastSync: {
            ...prev.lastSync,
            [source]: Date.now(),
          },
        }));

        return games.length;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: error instanceof Error ? error.message : 'Import failed',
        }));
        return 0;
      }
    },
    [state.connectedAccounts, addGames]
  );

  /**
   * Import games from PGN string.
   */
  const importFromPGN = useCallback(
    (pgn: string, playerUsername?: string): number => {
      if (!isValidPGN(pgn)) {
        setState((prev) => ({
          ...prev,
          error: 'Invalid PGN format',
        }));
        return 0;
      }

      const games = parsePGNFile(pgn, playerUsername);
      addGames(games);
      return games.length;
    },
    [addGames]
  );

  /**
   * Import games from PGN file.
   */
  const importFromFile = useCallback(
    async (file: File, playerUsername?: string): Promise<number> => {
      setState((prev) => ({ ...prev, isImporting: true, error: null }));

      try {
        const content = await file.text();
        const count = importFromPGN(content, playerUsername);

        setState((prev) => ({ ...prev, isImporting: false }));
        return count;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: 'Failed to read PGN file',
        }));
        return 0;
      }
    },
    [importFromPGN]
  );

  /**
   * Get a single game by ID.
   */
  const getGame = useCallback(
    (id: string): ArchivedGame | undefined => {
      return state.games.find((g) => g.id === id);
    },
    [state.games]
  );

  /**
   * Delete a game.
   */
  const deleteGame = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.id !== id),
    }));
  }, []);

  /**
   * Delete all games from a source.
   */
  const deleteFromSource = useCallback((source: GameSource) => {
    setState((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.source !== source),
    }));
  }, []);

  /**
   * Clear all games.
   */
  const clearAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      games: [],
    }));
  }, []);

  /**
   * Get filtered and sorted games.
   */
  const getFilteredGames = useCallback(
    (filter?: GameFilter, sort?: GameSort): ArchivedGame[] => {
      let filtered = [...state.games];

      if (filter) {
        if (filter.result) {
          filtered = filtered.filter((g) => g.result === filter.result);
        }
        if (filter.category) {
          filtered = filtered.filter((g) => g.category === filter.category);
        }
        if (filter.source) {
          filtered = filtered.filter((g) => g.source === filter.source);
        }
        if (filter.opponent) {
          const searchLower = filter.opponent.toLowerCase();
          filtered = filtered.filter((g) =>
            g.opponent.username.toLowerCase().includes(searchLower)
          );
        }
        if (filter.dateFrom) {
          filtered = filtered.filter((g) => g.playedAt >= filter.dateFrom!);
        }
        if (filter.dateTo) {
          filtered = filtered.filter((g) => g.playedAt <= filter.dateTo!);
        }
        if (filter.opening) {
          const searchLower = filter.opening.toLowerCase();
          filtered = filtered.filter(
            (g) => g.opening?.toLowerCase().includes(searchLower)
          );
        }
      }

      if (sort) {
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (sort.field) {
            case 'playedAt':
              comparison =
                new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime();
              break;
            case 'rating':
              comparison = (a.opponent.rating || 0) - (b.opponent.rating || 0);
              break;
            case 'opponent':
              comparison = a.opponent.username.localeCompare(b.opponent.username);
              break;
          }
          return sort.direction === 'desc' ? -comparison : comparison;
        });
      }

      return filtered;
    },
    [state.games]
  );

  /**
   * Get game statistics.
   */
  const getStats = useCallback((): GameArchiveStats => {
    const games = state.games;
    const wins = games.filter((g) => g.result === 'win').length;
    const losses = games.filter((g) => g.result === 'loss').length;
    const draws = games.filter((g) => g.result === 'draw').length;

    const bySource: Record<GameSource, number> = {
      'chess.com': games.filter((g) => g.source === 'chess.com').length,
      lichess: games.filter((g) => g.source === 'lichess').length,
      pgn: games.filter((g) => g.source === 'pgn').length,
    };

    const byCategory: Record<string, number> = {};
    games.forEach((g) => {
      byCategory[g.category] = (byCategory[g.category] || 0) + 1;
    });

    return {
      totalGames: games.length,
      wins,
      losses,
      draws,
      winRate: games.length > 0 ? (wins / games.length) * 100 : 0,
      bySource,
      byCategory,
    };
  }, [state.games]);

  return {
    // State
    games: state.games,
    connectedAccounts: state.connectedAccounts,
    isImporting: state.isImporting,
    error: state.error,

    // Import actions
    connectChessCom,
    connectLichess,
    disconnect,
    importFromSource,
    importFromPGN,
    importFromFile,

    // Game management
    getGame,
    deleteGame,
    deleteFromSource,
    clearAll,

    // Filtering and sorting
    getFilteredGames,
    getStats,
  };
}

export default useGameArchive;
