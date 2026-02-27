'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CodexActionLine } from '@/components/shared/CodexActionLine';
import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';
import { CodexKeyValue } from '@/components/shared/CodexKeyValue';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type { SessionFull, SessionSummary } from '@/types/lmx';

export default function SessionsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionFull | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await client.getSessions({ limit: 50 });
      setSessions(response.sessions);
      setSelectedSessionId((current) => current ?? response.sessions[0]?.id ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load sessions',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const loadSelected = useCallback(async () => {
    if (!client || !selectedSessionId) return;

    setError(null);
    try {
      const session = await client.getSession(selectedSessionId);
      setSelectedSession(session);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load session detail',
      );
    }
  }, [client, selectedSessionId]);

  const deleteSelected = useCallback(async () => {
    if (!client || !selectedSessionId) return;

    setIsDeleting(true);
    setError(null);
    try {
      await client.deleteSession(selectedSessionId);
      if (selectedSessionId === selectedSession?.id) setSelectedSession(null);
      await loadSessions();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete session',
      );
    } finally {
      setIsDeleting(false);
    }
  }, [client, loadSessions, selectedSession?.id, selectedSessionId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    void loadSelected();
  }, [loadSelected]);

  const selectedSummary = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Sessions"
        subtitle="Compact session browser with explicit reload and delete actions."
      >
        <CodexActionLine
          primaryLabel={isLoading ? 'Refreshing...' : 'Refresh'}
          primaryDisabled={isLoading || !client}
          onPrimary={() => void loadSessions()}
          secondary={
            <button
              type="button"
              className="codex-secondary-btn"
              onClick={() => void deleteSelected()}
              disabled={!selectedSessionId || isDeleting || !client}
            >
              {isDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          }
        />
        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      </CodexDenseSurface>

      <div className="codex-grid-2">
        <CodexDenseSurface title="Session List" subtitle="Recent first">
          {sessions.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>No sessions found.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className="w-full rounded border border-opta-border bg-opta-surface/30 p-2 text-left"
                style={{
                  outline:
                    selectedSessionId === session.id
                      ? '1px solid var(--accent)'
                      : 'none',
                }}
              >
                <div className="codex-kv-mono" style={{ fontSize: 12 }}>
                  {session.id}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {session.title}
                </div>
              </button>
            ))
          )}
        </CodexDenseSurface>

        <CodexDenseSurface title="Session Detail" subtitle="Selected session metadata">
          <CodexKeyValue label="ID" value={selectedSummary?.id ?? '-'} mono />
          <CodexKeyValue label="Title" value={selectedSummary?.title ?? '-'} />
          <CodexKeyValue label="Model" value={selectedSummary?.model ?? '-'} />
          <CodexKeyValue
            label="Messages"
            value={selectedSummary?.message_count ?? '-'}
          />
          <CodexKeyValue label="Updated" value={selectedSummary?.updated ?? '-'} />

          <h3 className="codex-kv-label" style={{ marginBottom: 0 }}>
            Full Session JSON
          </h3>
          <pre className="max-h-72 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs">
            {selectedSession
              ? JSON.stringify(selectedSession, null, 2)
              : 'Select a session for full payload.'}
          </pre>
        </CodexDenseSurface>
      </div>
    </main>
  );
}
