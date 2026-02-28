'use client';

/**
 * Benchmark Page — Run inference benchmarks and view history.
 *
 * Provides a model selector + run button (runBenchmark) and a results
 * history table (listBenchmarks).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, FlaskConical, Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import { useModels } from '@/hooks/useModels';
import type { BenchmarkResult, BenchmarkRequest } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BenchmarkPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const { models } = useModels(client);

  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedModel, setSelectedModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(256);
  const [runs, setRuns] = useState(3);

  // Auto-select first model
  useEffect(() => {
    if (!selectedModel && models.length > 0 && models[0]) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  const fetchResults = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const data = await client.getBenchmarkResults();
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => { void fetchResults(); }, [fetchResults]);

  const handleRun = useCallback(async () => {
    if (!client || !selectedModel) return;
    setIsRunning(true);
    setError(null);
    try {
      const req: BenchmarkRequest = {
        model_id: selectedModel,
        max_tokens: maxTokens,
        runs,
      };
      const result = await client.runBenchmark(req);
      setResults((prev) => [result, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Benchmark failed');
    } finally {
      setIsRunning(false);
    }
  }, [client, selectedModel, maxTokens, runs]);

  const formatMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;

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
        <FlaskConical className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Benchmark</h1>
        <div className="ml-auto">
          <button
            onClick={() => void fetchResults()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh results"
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
            {/* Run form */}
            <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                Run Benchmark
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-text-muted block mb-1">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isRunning || models.length === 0}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-sm',
                      'bg-opta-surface text-text-primary',
                      'border border-opta-border outline-none',
                      'disabled:opacity-50',
                    )}
                  >
                    {models.length === 0 && <option value="">No models loaded</option>}
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">Max tokens</label>
                  <input
                    type="number"
                    min={32}
                    max={4096}
                    step={32}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    disabled={isRunning}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-sm',
                      'bg-opta-surface text-text-primary',
                      'border border-opta-border outline-none',
                      'disabled:opacity-50',
                    )}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">Runs</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={runs}
                    onChange={(e) => setRuns(Number(e.target.value))}
                    disabled={isRunning}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-sm',
                      'bg-opta-surface text-text-primary',
                      'border border-opta-border outline-none',
                      'disabled:opacity-50',
                    )}
                  />
                </div>
              </div>
              <button
                onClick={() => void handleRun()}
                disabled={isRunning || !selectedModel}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  'bg-primary/15 text-primary hover:bg-primary/25',
                  'disabled:opacity-50 disabled:pointer-events-none',
                )}
              >
                <Play className={cn('w-4 h-4', isRunning && 'animate-pulse')} />
                {isRunning ? 'Running…' : 'Run Benchmark'}
              </button>
            </OptaSurface>

            {/* Results table */}
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                History ({results.length})
              </h2>
              {isLoading && results.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">Loading…</p>
              ) : results.length === 0 ? (
                <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl text-center">
                  <FlaskConical className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">No benchmark results yet. Run one above.</p>
                </OptaSurface>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-opta-border text-text-muted">
                        <th className="text-left py-2 px-3 font-medium">Model</th>
                        <th className="text-right py-2 px-3 font-medium">TPS</th>
                        <th className="text-right py-2 px-3 font-medium">TTFT</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-center py-2 px-3 font-medium">Coherent</th>
                        <th className="text-right py-2 px-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <motion.tr
                          key={`${r.model_id}-${r.timestamp}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-opta-border/50 hover:bg-primary/5 transition-colors"
                        >
                          <td className="py-2 px-3 text-text-primary font-mono max-w-xs truncate">{r.model_id}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-text-primary font-medium">
                            {r.tokens_per_second.toFixed(1)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-text-secondary">
                            {formatMs(r.ttft_ms)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-text-secondary">
                            {formatMs(r.total_time_ms)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.coherent !== undefined && (
                              <OptaStatusPill
                                label={r.coherent ? 'Yes' : 'No'}
                                status={r.coherent ? 'success' : 'danger'}
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-text-muted">
                            {new Date(r.timestamp).toLocaleDateString()}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
