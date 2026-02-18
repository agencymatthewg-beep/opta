'use client';

/**
 * useSessions — SWR hook for fetching and searching CLI sessions.
 *
 * Fetches session summaries from LMX /admin/sessions via SWR with
 * 30-second auto-refresh (new sessions may appear from CLI usage).
 * Integrates Fuse.js for instant client-side fuzzy search across
 * title, model, tags, and session ID. Supports model and tag filtering.
 */

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { LMXClient } from '@/lib/lmx-client';
import type { SessionSummary, SessionListResponse } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Fuse.js configuration
// ---------------------------------------------------------------------------

const FUSE_OPTIONS: IFuseOptions<SessionSummary> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'model', weight: 0.2 },
    { name: 'tags', weight: 0.3 },
    { name: 'id', weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSessionsReturn {
  /** All sessions from the server (unfiltered) */
  sessions: SessionSummary[];
  /** Sessions after applying search query and filters */
  filteredSessions: SessionSummary[];
  /** Total session count from server */
  total: number;
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Error from fetch, if any */
  error: Error | undefined;
  /** Current search query */
  searchQuery: string;
  /** Set the fuzzy search query */
  setSearchQuery: (query: string) => void;
  /** Current model filter (case-insensitive substring) */
  modelFilter: string;
  /** Set model filter */
  setModelFilter: (model: string) => void;
  /** Current tag filter (exact match) */
  tagFilter: string;
  /** Set tag filter */
  setTagFilter: (tag: string) => void;
  /** All unique models across sessions */
  availableModels: string[];
  /** All unique tags across sessions */
  availableTags: string[];
  /** Whether any filters are active */
  hasActiveFilters: boolean;
  /** Clear all search and filters */
  clearFilters: () => void;
  /** Manually refresh the session list */
  refresh: () => void;
  /** Delete a session by ID (optimistic update) */
  deleteSession: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSessions(client: LMXClient | null): UseSessionsReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  // Fetch sessions from LMX with SWR
  const { data, error, isLoading, mutate } = useSWR<SessionListResponse>(
    client ? 'lmx:sessions' : null,
    () => client!.getSessions({ limit: 200 }),
    {
      refreshInterval: 30_000, // Refresh every 30s (CLI may create sessions)
      revalidateOnFocus: true,
      errorRetryCount: 2,
      dedupingInterval: 5_000,
    },
  );

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  // Build Fuse.js index when sessions change
  const fuse = useMemo(
    () => new Fuse(sessions, FUSE_OPTIONS),
    [sessions],
  );

  // Extract unique models and tags for filter dropdowns
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    for (const s of sessions) {
      if (s.model) models.add(s.model);
    }
    return Array.from(models).sort();
  }, [sessions]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const s of sessions) {
      for (const t of s.tags) {
        tags.add(t);
      }
    }
    return Array.from(tags).sort();
  }, [sessions]);

  // Apply search + filters
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Fuzzy search via Fuse.js
    if (searchQuery.trim()) {
      result = fuse.search(searchQuery).map((r) => r.item);
    }

    // Model filter (case-insensitive substring)
    if (modelFilter) {
      const lower = modelFilter.toLowerCase();
      result = result.filter((s) =>
        s.model.toLowerCase().includes(lower),
      );
    }

    // Tag filter (exact match)
    if (tagFilter) {
      result = result.filter((s) => s.tags.includes(tagFilter));
    }

    return result;
  }, [sessions, searchQuery, fuse, modelFilter, tagFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || modelFilter !== '' || tagFilter !== '';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setModelFilter('');
    setTagFilter('');
  }, []);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  // Delete session with optimistic UI update
  const deleteSession = useCallback(
    async (id: string) => {
      if (!client) return;

      // Optimistic update: remove from local data immediately
      await mutate(
        async (current) => {
          await client.deleteSession(id);
          if (!current) return current;
          return {
            sessions: current.sessions.filter((s) => s.id !== id),
            total: current.total - 1,
          };
        },
        {
          optimisticData: data
            ? {
                sessions: data.sessions.filter((s) => s.id !== id),
                total: data.total - 1,
              }
            : undefined,
          rollbackOnError: true,
          revalidate: false,
        },
      );
    },
    [client, mutate, data],
  );

  return {
    sessions,
    filteredSessions,
    total,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    modelFilter,
    setModelFilter,
    tagFilter,
    setTagFilter,
    availableModels,
    availableTags,
    hasActiveFilters,
    clearFilters,
    refresh,
    deleteSession,
  };
}
