'use client';

/**
 * Metrics Page — Real-time inference metrics dashboard.
 *
 * Polls metrics(), predictorStats(), and helpersHealth() every 5 seconds.
 * Displays tokens/sec, TTFT, queue depth, and helper node status.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Activity, Zap, Clock, Server, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import type { MetricsJson, PredictorStats, HelperNodeStatus } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricsSnapshot {
  metrics: MetricsJson | null;
  predictor: PredictorStats | null;
  helpers: HelperNodeStatus[];
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  status?: 'neutral' | 'success' | 'warning' | 'danger';
}

function StatCard({ label, value, sub, icon, status = 'neutral' }: StatCardProps) {
  return (
    <OptaSurface hierarchy="raised" padding="md" className="rounded-xl flex items-start gap-3">
      <div className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        status === 'success' && 'bg-green-500/15 text-green-400',
        status === 'warning' && 'bg-amber-500/15 text-amber-400',
        status === 'danger'  && 'bg-red-500/15 text-red-400',
        status === 'neutral' && 'bg-primary/15 text-primary',
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted uppercase tracking-widest">{label}</p>
        <p className="text-xl font-bold text-text-primary tabular-nums">{value}</p>
        {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
      </div>
    </OptaSurface>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MetricsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [snapshot, setSnapshot] = useState<MetricsSnapshot>({
    metrics: null,
    predictor: null,
    helpers: [],
    fetchedAt: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const [metrics, predictor, helpers] = await Promise.allSettled([
        client.getMetricsJson(),
        client.getPredictorStats(),
        client.getHelpers(),
      ]);
      setSnapshot({
        metrics: metrics.status === 'fulfilled' ? metrics.value : null,
        predictor: predictor.status === 'fulfilled' ? predictor.value : null,
        helpers: helpers.status === 'fulfilled' ? helpers.value : [],
        fetchedAt: Date.now(),
      });
      if (metrics.status === 'rejected') {
        setError(String(metrics.reason));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Initial fetch + 5s polling
  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => { void fetchAll(); }, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const { metrics, predictor, helpers, fetchedAt } = snapshot;

  // Derive status colours for key metrics
  const tpsStatus = metrics
    ? metrics.tokens_per_second > 50 ? 'success'
    : metrics.tokens_per_second > 20 ? 'warning'
    : 'danger'
    : 'neutral';

  const errorRatio = metrics && metrics.total_requests > 0
    ? metrics.total_errors / metrics.total_requests
    : 0;
  const errStatus = errorRatio < 0.01 ? 'success' : errorRatio < 0.05 ? 'warning' : 'danger';

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
        <Activity className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Metrics</h1>
        <div className="ml-auto flex items-center gap-3">
          {fetchedAt > 0 && (
            <span className="text-xs text-text-muted">
              Updated {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => void fetchAll()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
          <p className="text-sm text-text-muted text-center pt-12">
            Not connected — check Settings.
          </p>
        ) : (
          <>
            {/* Inference KPIs */}
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                Inference
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Tokens / sec"
                  value={metrics ? metrics.tokens_per_second.toFixed(1) : '—'}
                  sub="generation throughput"
                  icon={<Zap className="w-4 h-4" />}
                  status={tpsStatus}
                />
                <StatCard
                  label="Avg latency"
                  value={metrics ? `${metrics.avg_latency_ms.toFixed(0)} ms` : '—'}
                  sub={metrics?.p95_latency_ms != null ? `p95 ${metrics.p95_latency_ms.toFixed(0)} ms` : undefined}
                  icon={<Clock className="w-4 h-4" />}
                  status={metrics ? (metrics.avg_latency_ms < 500 ? 'success' : metrics.avg_latency_ms < 2000 ? 'warning' : 'danger') : 'neutral'}
                />
                <StatCard
                  label="In-flight reqs"
                  value={metrics ? String(metrics.in_flight_requests) : '—'}
                  sub="concurrent requests"
                  icon={<Activity className="w-4 h-4" />}
                  status={metrics ? (metrics.in_flight_requests === 0 ? 'neutral' : metrics.in_flight_requests < 5 ? 'success' : 'warning') : 'neutral'}
                />
                <StatCard
                  label="Error rate"
                  value={metrics ? `${(errorRatio * 100).toFixed(2)}%` : '—'}
                  sub={metrics ? `${metrics.total_errors} / ${metrics.total_requests} reqs` : undefined}
                  icon={<Activity className="w-4 h-4" />}
                  status={errStatus}
                />
              </div>
            </section>

            {/* Totals */}
            {metrics && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                  Totals
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Total requests"
                    value={metrics.total_requests.toLocaleString()}
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <StatCard
                    label="Total tokens"
                    value={metrics.total_tokens.toLocaleString()}
                    icon={<Zap className="w-4 h-4" />}
                  />
                  <StatCard
                    label="Loaded models"
                    value={String(metrics.loaded_models)}
                    icon={<Server className="w-4 h-4" />}
                  />
                  <StatCard
                    label="Uptime"
                    value={
                      metrics.uptime_seconds >= 3600
                        ? `${(metrics.uptime_seconds / 3600).toFixed(1)}h`
                        : `${(metrics.uptime_seconds / 60).toFixed(0)}m`
                    }
                    icon={<Clock className="w-4 h-4" />}
                    status="success"
                  />
                </div>
              </section>
            )}

            {/* Speculative decoding */}
            {metrics?.speculative_accept_ratio != null && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                  Speculative Decoding
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Accept ratio"
                    value={`${(metrics.speculative_accept_ratio * 100).toFixed(1)}%`}
                    sub="draft token acceptance"
                    icon={<Zap className="w-4 h-4" />}
                    status={metrics.speculative_accept_ratio > 0.7 ? 'success' : metrics.speculative_accept_ratio > 0.4 ? 'warning' : 'danger'}
                  />
                </div>
              </section>
            )}

            {/* Predictor */}
            {predictor && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                  Predictor
                </h2>
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                  {predictor.next_predicted_model && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-text-muted">Next predicted model:</span>
                      <OptaStatusPill label={predictor.next_predicted_model} status="info" />
                    </div>
                  )}
                  <div className="space-y-2">
                    {Object.entries(predictor.usage_stats).map(([modelId, stats]) => (
                      <div key={modelId} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary font-mono truncate max-w-xs">{modelId}</span>
                        <div className="flex items-center gap-3 text-text-muted">
                          <span>{stats.count} uses</span>
                          <span>Last: {new Date(stats.last_used).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(predictor.usage_stats).length === 0 && (
                      <p className="text-xs text-text-muted">No usage history yet.</p>
                    )}
                  </div>
                </OptaSurface>
              </section>
            )}

            {/* Helper nodes */}
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                Helper Nodes ({helpers.length})
              </h2>
              {helpers.length === 0 ? (
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                  <p className="text-xs text-text-muted text-center">No helper nodes configured.</p>
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
                      <p className="text-xs text-text-muted mb-2 font-mono">{node.url}</p>
                      <div className="flex items-center gap-3 text-xs text-text-secondary">
                        {node.latency_p50_ms != null && (
                          <span>p50: {node.latency_p50_ms.toFixed(0)} ms</span>
                        )}
                        {node.latency_p95_ms != null && (
                          <span>p95: {node.latency_p95_ms.toFixed(0)} ms</span>
                        )}
                        {node.success_rate != null && (
                          <span>SR: {(node.success_rate * 100).toFixed(1)}%</span>
                        )}
                        {node.circuit_open && (
                          <OptaStatusPill label="Circuit Open" status="danger" />
                        )}
                      </div>
                    </OptaSurface>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
