'use client';

import { useCallback, useEffect, useState } from 'react';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';

export default function DiagnosticsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [memory, setMemory] = useState<unknown>(null);
  const [diagnostics, setDiagnostics] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextMemory, nextDiagnostics] = await Promise.all([
        client.getMemory(),
        client.getDiagnostics(),
      ]);
      setMemory(nextMemory);
      setDiagnostics(nextDiagnostics);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load diagnostics',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Diagnostics</h1>
          <p className="text-sm text-text-secondary">
            Runtime memory and diagnostics snapshots from LMX admin endpoints.
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          onClick={() => void refresh()}
          disabled={isLoading || !client}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">
            /admin/memory
          </h2>
          <pre className="max-h-[70vh] overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary">
            {memory ? JSON.stringify(memory, null, 2) : 'No data yet.'}
          </pre>
        </section>

        <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">
            /admin/diagnostics
          </h2>
          <pre className="max-h-[70vh] overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary">
            {diagnostics ? JSON.stringify(diagnostics, null, 2) : 'No data yet.'}
          </pre>
        </section>
      </div>
    </main>
  );
}

