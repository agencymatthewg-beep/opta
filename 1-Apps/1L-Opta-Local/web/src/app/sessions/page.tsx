'use client';

/**
 * Sessions Page — Browse, search, and resume CLI sessions.
 *
 * Full-height layout with search bar at the top, virtual-scrolled
 * session list filling the remaining space. Sessions are fetched from
 * LMX /admin/sessions via SWR with Fuse.js client-side search.
 * Clicking a session navigates to /chat/[id] for resumption.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn, Button } from '@opta/ui';

import { useSessions } from '@/hooks/useSessions';
import { createClient, getConnectionSettings } from '@/lib/connection';
import type { LMXClient } from '@/lib/lmx-client';
import { SessionSearch } from '@/components/sessions/SessionSearch';
import { SessionList } from '@/components/sessions/SessionList';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const router = useRouter();
  const [client, setClient] = useState<LMXClient | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  // Initialize LMX client from saved connection settings
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const settings = await getConnectionSettings();
        if (!cancelled) {
          setClient(createClient(settings));
        }
      } catch {
        if (!cancelled) {
          setSettingsError(true);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Session data + search + filters
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
  } = useSessions(client);

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

  // Settings error state
  if (settingsError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="glass-subtle max-w-sm rounded-xl p-8 text-center">
          <p className="mb-2 text-lg font-semibold text-text-primary">
            Settings Error
          </p>
          <p className="mb-4 text-sm text-text-secondary">
            Could not load connection settings. Please configure your server
            connection.
          </p>
          <Link href="/settings">
            <Button variant="primary" size="md">
              Go to Settings
            </Button>
          </Link>
        </div>
      </main>
    );
  }

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

        <h1 className="text-lg font-semibold text-text-primary">
          Sessions
        </h1>

        <div className="ml-auto flex items-center gap-2">
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
        <SessionSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          availableModels={availableModels}
          modelFilter={modelFilter}
          onModelFilterChange={setModelFilter}
          availableTags={availableTags}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          resultCount={filteredSessions.length}
          totalCount={total}
        />

        {/* Error banner */}
        {error && (
          <div className="glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20">
            Unable to load sessions. Make sure the LMX server is running.
          </div>
        )}

        {/* Virtual-scrolled session list fills remaining space */}
        <SessionList
          sessions={filteredSessions}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onResume={handleResume}
          onDelete={handleDelete}
          className="flex-1"
        />
      </div>
    </main>
  );
}
