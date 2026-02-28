'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type { AgentRun, AgentRunEvent } from '@/types/agents';

function formatTimestamp(value: number): string {
  try {
    return new Date(value * 1000).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function AgentRunsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!client) return;
    setIsLoadingRuns(true);
    setError(null);
    try {
      const response = await client.listAgentRuns({ limit: 50 });
      setRuns(response.data);
      setSelectedRunId((current) => current ?? response.data[0]?.id ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load agent runs',
      );
    } finally {
      setIsLoadingRuns(false);
    }
  }, [client]);

  const loadRunDetail = useCallback(async () => {
    if (!client || !selectedRunId) return;
    setIsLoadingDetail(true);
    setError(null);
    try {
      const run = await client.getAgentRun(selectedRunId);
      setSelectedRun(run);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load run detail',
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, [client, selectedRunId]);

  const loadEvents = useCallback(async () => {
    if (!client || !selectedRunId) return;
    setIsLoadingEvents(true);
    setError(null);
    try {
      const nextEvents: AgentRunEvent[] = [];
      let seen = 0;
      for await (const event of client.streamAgentRunEvents(selectedRunId)) {
        nextEvents.push(event);
        seen += 1;
        if (seen >= 20) break;
      }
      setEvents(nextEvents);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load events',
      );
    } finally {
      setIsLoadingEvents(false);
    }
  }, [client, selectedRunId]);

  const cancelRun = useCallback(async () => {
    if (!client || !selectedRunId) return;
    setIsCancelling(true);
    setError(null);
    try {
      const next = await client.cancelAgentRun(selectedRunId);
      setSelectedRun(next);
      await loadRuns();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Failed to cancel run',
      );
    } finally {
      setIsCancelling(false);
    }
  }, [client, loadRuns, selectedRunId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadRunDetail();
    setEvents([]);
  }, [loadRunDetail]);

  const currentRun = useMemo(() => {
    if (selectedRun && selectedRun.id === selectedRunId) return selectedRun;
    return runs.find((run) => run.id === selectedRunId) ?? null;
  }, [runs, selectedRun, selectedRunId]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Agent Runs</h1>
        <p className="text-sm text-text-secondary">
          List, inspect, cancel, and stream event timelines for agent runs.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-opta-border bg-opta-surface/20">
          <div className="flex items-center justify-between border-b border-opta-border px-3 py-2">
            <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Runs
            </span>
            <button
              type="button"
              className="text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void loadRuns()}
              disabled={isLoadingRuns || !client}
            >
              {isLoadingRuns ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="max-h-[70vh] overflow-auto p-2">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                data-testid="agent-run-item"
                onClick={() => setSelectedRunId(run.id)}
                className="mb-1 w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-2 text-left text-xs text-text-primary"
              >
                <div className="font-mono">{run.id}</div>
                <div className="mt-0.5 text-text-muted">{run.status}</div>
              </button>
            ))}
            {runs.length === 0 && (
              <p className="px-2 py-3 text-xs text-text-muted">No runs yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void loadRunDetail()}
              disabled={!selectedRunId || isLoadingDetail || !client}
            >
              {isLoadingDetail ? 'Loading...' : 'Reload Detail'}
            </button>
            <button
              type="button"
              data-testid="cancel-run-button"
              className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void cancelRun()}
              disabled={!selectedRunId || isCancelling || !client}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Run'}
            </button>
            <button
              type="button"
              data-testid="load-events-button"
              className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void loadEvents()}
              disabled={!selectedRunId || isLoadingEvents || !client}
            >
              {isLoadingEvents ? 'Loading Events...' : 'Load Events'}
            </button>
          </div>

          {error && (
            <p className="mb-3 rounded border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
              {error}
            </p>
          )}

          <h2 className="mb-1 text-xs uppercase tracking-[0.12em] text-text-muted">
            Selected Run
          </h2>
          {currentRun ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
              <dt className="text-text-muted">ID</dt>
              <dd className="font-mono text-text-primary">{currentRun.id}</dd>
              <dt className="text-text-muted">Status</dt>
              <dd data-testid="selected-run-status" className="text-text-primary">
                {currentRun.status}
              </dd>
              <dt className="text-text-muted">Created</dt>
              <dd className="text-text-primary">
                {formatTimestamp(currentRun.created_at)}
              </dd>
              <dt className="text-text-muted">Updated</dt>
              <dd className="text-text-primary">
                {formatTimestamp(currentRun.updated_at)}
              </dd>
            </dl>
          ) : (
            <p className="text-xs text-text-muted">Select a run from the list.</p>
          )}

          <h3 className="mt-4 mb-1 text-xs uppercase tracking-[0.12em] text-text-muted">
            Events
          </h3>
          <pre
            data-testid="run-events-panel"
            className="max-h-64 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary"
          >
            {events.length > 0 ? JSON.stringify(events, null, 2) : 'No events loaded.'}
          </pre>
        </section>
      </div>
    </main>
  );
}

