'use client';

/**
 * Sessions Page — Browse, search, and resume CLI sessions.
 *
 * Full-height layout with search bar at the top, virtual-scrolled
 * session list filling the remaining space. Sessions are fetched from
 * LMX /admin/sessions via SWR with Fuse.js client-side search.
 * Server-side full-text search is available via the LMX searchSessions API.
 * Clicking a session navigates to /chat/[id] for resumption.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { cn, Button } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useSessions } from '@/hooks/useSessions';
import { SessionSearch } from '@/components/sessions/SessionSearch';
import { SessionList } from '@/components/sessions/SessionList';
import type { SessionSummary } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const router = useRouter();
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  // Session data + client-side search + filters
  const {
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
    search: serverSearch,
  } = useSessions(client);

  // Server-side search state
  const [serverResults, setServerResults] = useState<SessionSummary[] | null>(null);
  const [isServerSearching, setIsServerSearching] = useState(false);
  const [serverSearchError, setServerSearchError] = useState<string | null>(null);
  const [lastServerQuery, setLastServerQuery] = useState('');

  /** Trigger server-side full-text search via LMX API */
  const handleServerSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || !client) return;
    setIsServerSearching(true);
    setServerSearchError(null);
    setLastServerQuery(q);
    try {
      const results = await serverSearch(q);
      setServerResults(results);
    } catch (e) {
      setServerSearchError(e instanceof Error ? e.message : 'Server search failed');
      setServerResults(null);
    } finally {
      setIsServerSearching(false);
    }
  }, [searchQuery, client, serverSearch]);

  /** Clear server-side search results and return to client-side view */
  const clearServerResults = useCallback(() => {
    setServerResults(null);
    setLastServerQuery('');
    setServerSearchError(null);
  }, []);

  const handleResume = useCallback(
    (sessionId: string) => {
      router.push(`/chat/${sessionId}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      void deleteSession(sessionId);
    },
    [deleteSession],
  );

  // Decide which session list to show
  const displaySessions = serverResults ?? filteredSessions;
  const displayCount = serverResults ? serverResults.length : filteredSessions.length;
  const displayTotal = serverResults ? serverResults.length : total;

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <h1 className="text-lg font-semibold text-text-primary">Sessions</h1>

        <div className="ml-auto flex items-center gap-2">
          {serverResults && (
            <button
              onClick={clearServerResults}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                'bg-primary/10 text-primary hover:bg-primary/20',
              )}
            >
              ✕ Clear server results
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            aria-label="Refresh sessions"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
        {/* Search + filters */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SessionSearch
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                // Clear server results when query changes
                if (serverResults) clearServerResults();
              }}
              availableModels={availableModels}
              modelFilter={modelFilter}
              onModelFilterChange={setModelFilter}
              availableTags={availableTags}
              tagFilter={tagFilter}
              onTagFilterChange={setTagFilter}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              resultCount={displayCount}
              totalCount={displayTotal}
            />
          </div>
          {/* Server-side search button */}
          <Button
            variant="glass"
            size="sm"
            onClick={() => void handleServerSearch()}
            disabled={!searchQuery.trim() || isServerSearching || !client}
            aria-label="Search server-side"
            title="Full-text search via LMX server"
          >
            {isServerSearching ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Server</span>
          </Button>
        </div>

        {/* Server search banner */}
        {serverResults && lastServerQuery && (
          <div className="glass-subtle rounded-xl px-4 py-2 text-xs text-primary border border-primary/20 flex items-center gap-2">
            <SearchIcon className="w-3.5 h-3.5 shrink-0" />
            <span>
              Server search: <span className="font-medium">&quot;{lastServerQuery}&quot;</span> — {serverResults.length} result{serverResults.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Error banners */}
        {error && (
          <div className="glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20">
            Unable to load sessions. Make sure the LMX server is running.
          </div>
        )}
        {serverSearchError && (
          <div className="glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20">
            Server search error: {serverSearchError}
          </div>
        )}

        {/* Virtual-scrolled session list fills remaining space */}
        <SessionList
          sessions={displaySessions}
          isLoading={isLoading || isServerSearching}
          hasActiveFilters={hasActiveFilters || !!serverResults}
          onResume={handleResume}
          onDelete={handleDelete}
          className="flex-1"
        />
      </div>
    </main>
  );
}
