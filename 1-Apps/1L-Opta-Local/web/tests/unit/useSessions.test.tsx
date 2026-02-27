import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import type { LMXClient } from '@/lib/lmx-client';
import { useSessions } from '@/hooks/useSessions';
import type { SessionSummary } from '@/types/lmx';

const mockSessions: SessionSummary[] = [
  {
    id: 'session-1',
    title: 'Design dashboard metrics',
    model: 'llama-3.1-8b',
    tags: ['product', 'planning'],
    created: '2026-02-20T10:00:00.000Z',
    updated: '2026-02-20T10:01:00.000Z',
    message_count: 4,
  },
  {
    id: 'session-2',
    title: 'Debug flaky CI pipeline',
    model: 'llama-3.1-8b',
    tags: ['debugging', 'infra'],
    created: '2026-02-20T11:00:00.000Z',
    updated: '2026-02-20T11:03:00.000Z',
    message_count: 6,
  },
  {
    id: 'session-3',
    title: 'Summarize support backlog',
    model: 'claude-3.5-sonnet',
    tags: ['ops'],
    created: '2026-02-20T12:00:00.000Z',
    updated: '2026-02-20T12:05:00.000Z',
    message_count: 3,
  },
];

function createSWRWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
          shouldRetryOnError: false,
        }}
      >
        {children}
      </SWRConfig>
    );
  };
}

function createClientFixture() {
  const getSessions = vi.fn().mockResolvedValue({
    sessions: mockSessions,
    total: mockSessions.length,
  });
  const deleteSession = vi.fn().mockResolvedValue(undefined);

  return {
    client: { getSessions, deleteSession } as unknown as LMXClient,
    getSessions,
    deleteSession,
  };
}

describe('useSessions', () => {
  it('applies fuzzy search, model filter, tag filter, and clearFilters', async () => {
    const { client } = createClientFixture();

    const { result } = renderHook(() => useSessions(client), {
      wrapper: createSWRWrapper(),
    });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3);
    });

    expect(result.current.availableModels).toEqual([
      'claude-3.5-sonnet',
      'llama-3.1-8b',
    ]);
    expect(result.current.availableTags).toEqual([
      'debugging',
      'infra',
      'ops',
      'planning',
      'product',
    ]);

    act(() => {
      result.current.setSearchQuery('flaky');
    });

    await waitFor(() => {
      expect(result.current.filteredSessions.map((s) => s.id)).toEqual(['session-2']);
    });

    act(() => {
      result.current.setModelFilter('claude');
    });

    await waitFor(() => {
      expect(result.current.filteredSessions).toHaveLength(0);
    });

    act(() => {
      result.current.setModelFilter('');
      result.current.setTagFilter('debugging');
    });

    await waitFor(() => {
      expect(result.current.filteredSessions.map((s) => s.id)).toEqual(['session-2']);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    act(() => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.filteredSessions).toHaveLength(3);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  it('optimistically removes a deleted session and updates total', async () => {
    const { client, deleteSession } = createClientFixture();

    const { result } = renderHook(() => useSessions(client), {
      wrapper: createSWRWrapper(),
    });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3);
    });

    await act(async () => {
      await result.current.deleteSession('session-2');
    });

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('session-2');
      expect(result.current.sessions.map((s) => s.id)).toEqual([
        'session-1',
        'session-3',
      ]);
      expect(result.current.total).toBe(2);
    });
  });
});
