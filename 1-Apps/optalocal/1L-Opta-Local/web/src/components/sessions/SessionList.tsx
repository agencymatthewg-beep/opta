'use client';

/**
 * SessionList — Virtualized session list using @tanstack/react-virtual.
 *
 * Renders SessionCard for each visible session in a virtual scroll container.
 * Handles empty states (no sessions vs. no search results) and a loading
 * skeleton state. Uses AnimatePresence for smooth delete transitions.
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';
import { MessageSquare, SearchX } from 'lucide-react';
import { cn } from '@opta/ui';
import type { SessionSummary } from '@/types/lmx';
import { SessionCard } from './SessionCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionListProps {
  /** Sessions to display (already filtered/searched) */
  sessions: SessionSummary[];
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether search/filters are active (changes empty state message) */
  hasActiveFilters: boolean;
  /** Called when user clicks to resume a session */
  onResume: (id: string) => void;
  /** Called when user deletes a session */
  onDelete: (id: string) => void;
  /** Additional class names for the container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Estimated row height for virtual scroll (px) */
const ESTIMATED_ROW_HEIGHT = 100;

/** Extra items to render outside the visible area */
const OVERSCAN = 5;

/** Gap between session cards (px) */
const GAP = 8;

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="glass-subtle rounded-xl px-5 py-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-4 w-48 bg-opta-elevated rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-5 w-32 bg-opta-elevated rounded-full" />
        <div className="h-3 w-8 bg-opta-elevated rounded" />
        <div className="h-3 w-20 bg-opta-elevated rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchX className="w-12 h-12 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          No matching sessions
        </h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Try adjusting your search query or clearing the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-6">
        <MessageSquare className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">
        No sessions yet
      </h3>
      <p className="text-sm text-text-secondary max-w-sm">
        Start a conversation in the CLI or chat page. Your sessions will
        appear here for easy resumption.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionList({
  sessions,
  isLoading,
  hasActiveFilters,
  onResume,
  onDelete,
  className,
}: SessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    gap: GAP,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-2 overflow-hidden', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (sessions.length === 0) {
    return <EmptyState hasFilters={hasActiveFilters} />;
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="popLayout">
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const session = sessions[virtualRow.index];
            if (!session) return null;

            return (
              <div
                key={session.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <SessionCard
                  session={session}
                  onResume={onResume}
                  onDelete={onDelete}
                />
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
