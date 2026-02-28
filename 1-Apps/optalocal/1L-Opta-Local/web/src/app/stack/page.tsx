'use client';

/**
 * Stack Page — Infrastructure overview.
 *
 * Shows stack role assignments (stack()), memory breakdown (memory()),
 * and helper node health (getHelpers()).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Server, MemoryStick, Network, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import type { StackInfo, MemoryDetail, HelperNodeStatus } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Memory bar
// ---------------------------------------------------------------------------

function MemoryBar({ usedGb, totalGb }: { usedGb: number; totalGb: number }) {
  const pct = totalGb > 0 ? (usedGb / totalGb) * 100 : 0;
  const color = pct > 85 ? 'bg-neon-red' : pct > 65 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-opta-surface overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{usedGb.toFixed(1)} GB used</span>
        <span>{totalGb.toFixed(1)} GB total</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface StackSnapshot {
  stack: StackInfo | null;
  memory: MemoryDetail | null;
  helpers: HelperNodeStatus[];
}

export default function StackPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [snapshot, setSnapshot] = useState<StackSnapshot>({ stack: null, memory: null, helpers: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const [stackRes, memRes, helpRes] = await Promise.allSettled([
        client.getStack(),
        client.getMemory(),
        client.getHelpers(),
      ]);
      setSnapshot({
        stack: stackRes.status === 'fulfilled' ? stackRes.value : null,
        memory: memRes.status === 'fulfilled' ? memRes.value : null,
        helpers: helpRes.status === 'fulfilled' ? helpRes.value : [],
      });
      if (stackRes.status === 'rejected') {
        setError(String(stackRes.reason));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stack info');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const { stack, memory, helpers } = snapshot;

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn('p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Network className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Stack</h1>
        <div className="ml-auto">
          <button
            onClick={() => void fetchAll()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {!client ? (
          <p className="text-sm text-text-muted text-center pt-12">Not connected — check Settings.</p>
        ) : (
          <>
            {/* Memory breakdown */}
            {memory && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MemoryStick className="w-3.5 h-3.5" />
                  Memory
                </h2>
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl space-y-4">
                  <MemoryBar usedGb={memory.used_gb} totalGb={memory.total_gb} />
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="glass-subtle rounded-lg p-2">
                      <p className="text-text-muted mb-1">Used</p>
                      <p className="font-bold text-text-primary">{memory.used_gb.toFixed(1)} GB</p>
                    </div>
                    <div className="glass-subtle rounded-lg p-2">
                      <p className="text-text-muted mb-1">Available</p>
                      <p className="font-bold text-text-primary">{memory.available_gb.toFixed(1)} GB</p>
                    </div>
                    <div className="glass-subtle rounded-lg p-2">
                      <p className="text-text-muted mb-1">Threshold</p>
                      <p className="font-bold text-text-primary">{memory.threshold_percent}%</p>
                    </div>
                  </div>
                  {Object.keys(memory.models).length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-text-muted mb-2">Model Memory</h3>
                      <div className="space-y-1">
                        {Object.entries(memory.models).map(([modelId, info]) => (
                          <div key={modelId} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary font-mono truncate max-w-xs">{modelId}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">{info.memory_gb.toFixed(2)} GB</span>
                              <OptaStatusPill label={info.loaded ? 'Loaded' : 'Unloaded'} status={info.loaded ? 'success' : 'neutral'} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </OptaSurface>
              </section>
            )}

            {/* Stack roles */}
            {stack && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  Roles
                </h2>
                <OptaSurface hierarchy="raised" padding="none" className="rounded-xl overflow-hidden">
                  {stack.default_model && (
                    <div className="px-4 py-3 border-b border-opta-border flex items-center justify-between">
                      <span className="text-xs text-text-muted">Default model</span>
                      <span className="text-xs font-mono text-text-primary">{stack.default_model}</span>
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-opta-border text-text-muted">
                        <th className="text-left py-2 px-4 font-medium">Role</th>
                        <th className="text-left py-2 px-4 font-medium">Model</th>
                        <th className="text-center py-2 px-4 font-medium">Loaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stack.roles).map(([role, info]) => (
                        <tr key={role} className="border-b border-opta-border/50 hover:bg-primary/5 transition-colors">
                          <td className="py-2 px-4 text-text-primary font-medium">{role}</td>
                          <td className="py-2 px-4 text-text-secondary font-mono">{info.model_id}</td>
                          <td className="py-2 px-4 text-center">
                            <OptaStatusPill label={info.loaded ? 'Yes' : 'No'} status={info.loaded ? 'success' : 'neutral'} />
                          </td>
                        </tr>
                      ))}
                      {Object.keys(stack.roles).length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-text-muted">No roles configured</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </OptaSurface>
              </section>
            )}

            {/* Helper nodes */}
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                <Network className="w-3.5 h-3.5" />
                Helper Nodes ({helpers.length})
              </h2>
              {helpers.length === 0 ? (
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl text-center">
                  <p className="text-xs text-text-muted">No helper nodes configured.</p>
                </OptaSurface>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {helpers.map((node) => (
                    <OptaSurface key={node.name} hierarchy="raised" padding="md" className="rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-text-primary">{node.name}</span>
                        <OptaStatusPill
                          label={node.healthy ? 'Healthy' : 'Unhealthy'}
                          status={node.healthy ? 'success' : 'danger'}
                        />
                      </div>
                      <p className="text-xs text-text-muted font-mono mb-2">{node.url}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                        {node.latency_p50_ms != null && <span>p50: {node.latency_p50_ms.toFixed(0)} ms</span>}
                        {node.latency_p95_ms != null && <span>p95: {node.latency_p95_ms.toFixed(0)} ms</span>}
                        {node.success_rate != null && <span>SR: {(node.success_rate * 100).toFixed(1)}%</span>}
                        {node.circuit_open && (
                          <OptaStatusPill label="Circuit Open" status="danger" />
                        )}
                      </div>
                    </OptaSurface>
                  ))}
                </div>
              )}
            </section>

            {/* Backend configs */}
            {stack && Object.keys(stack.backend_configs).length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                  Backend Configs
                </h2>
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-opta-surface/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    {JSON.stringify(stack.backend_configs, null, 2)}
                  </pre>
                </OptaSurface>
              </section>
            )}

            {isLoading && !stack && !memory && (
              <p className="text-sm text-text-muted text-center py-8">Loading…</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
