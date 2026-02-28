'use client';

/**
 * Quantize Page — Launch quantization jobs and monitor progress.
 *
 * Provides a launcher form (quantizeStart) and polls active jobs
 * every 3 seconds (quantizeStatus). Lists all jobs (quantizeJobs).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Package, Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import type { QuantizeJob, QuantizeRequest } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Status pill helper
// ---------------------------------------------------------------------------

function JobStatusPill({ status }: { status: QuantizeJob['status'] }) {
  const map: Record<QuantizeJob['status'], 'neutral' | 'info' | 'success' | 'danger'> = {
    pending: 'neutral',
    running: 'info',
    completed: 'success',
    failed: 'danger',
  };
  return <OptaStatusPill label={status} status={map[status]} />;
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 rounded-full bg-opta-surface overflow-hidden">
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QuantizePage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [jobs, setJobs] = useState<QuantizeJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [repoId, setRepoId] = useState('');
  const [bits, setBits] = useState<4 | 8>(4);
  const [revision, setRevision] = useState('');

  // Track active job IDs for polling
  const activeJobIds = useRef<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const data = await client.listQuantizeJobs();
      setJobs(data);
      // Update active set
      const active = new Set(
        data.filter((j) => j.status === 'pending' || j.status === 'running').map((j) => j.job_id)
      );
      activeJobIds.current = active;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Poll active jobs every 3s
  useEffect(() => {
    void fetchJobs();
    const id = setInterval(async () => {
      if (!client || activeJobIds.current.size === 0) return;
      // Refresh all for simplicity (handles completion transitions)
      try {
        const data = await client.listQuantizeJobs();
        setJobs(data);
        const active = new Set(
          data.filter((j) => j.status === 'pending' || j.status === 'running').map((j) => j.job_id)
        );
        activeJobIds.current = active;
      } catch {
        // Ignore poll errors
      }
    }, 3000);
    return () => clearInterval(id);
  }, [client, fetchJobs]);

  const handleStart = useCallback(async () => {
    if (!client || !repoId.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      const req: QuantizeRequest = { repo_id: repoId.trim(), bits };
      if (revision.trim()) req.revision = revision.trim();
      const job = await client.startQuantize(req);
      setJobs((prev) => [job, ...prev]);
      activeJobIds.current.add(job.job_id);
      setRepoId('');
      setRevision('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start quantization');
    } finally {
      setIsStarting(false);
    }
  }, [client, repoId, bits, revision]);

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
        <Package className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Quantize</h1>
        <div className="ml-auto">
          <button
            onClick={() => void fetchJobs()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh jobs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">
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
            {/* Launch form */}
            <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                New Quantization Job
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    HuggingFace Repo ID
                  </label>
                  <input
                    type="text"
                    value={repoId}
                    onChange={(e) => setRepoId(e.target.value)}
                    disabled={isStarting}
                    placeholder="e.g. mlx-community/Qwen2.5-7B-Instruct-4bit"
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-sm',
                      'bg-opta-surface text-text-primary placeholder:text-text-muted',
                      'border border-opta-border outline-none',
                      'disabled:opacity-50',
                    )}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">Bits</label>
                  <div className="flex gap-2">
                    {([4, 8] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBits(b)}
                        disabled={isStarting}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-sm font-medium transition-colors border',
                          bits === b
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-opta-border text-text-secondary hover:bg-opta-surface/50',
                          'disabled:opacity-50',
                        )}
                      >
                        {b}-bit
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Revision <span className="text-text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    disabled={isStarting}
                    placeholder="main"
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-sm',
                      'bg-opta-surface text-text-primary placeholder:text-text-muted',
                      'border border-opta-border outline-none',
                      'disabled:opacity-50',
                    )}
                  />
                </div>
              </div>
              <button
                onClick={() => void handleStart()}
                disabled={isStarting || !repoId.trim()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  'bg-primary/15 text-primary hover:bg-primary/25',
                  'disabled:opacity-50 disabled:pointer-events-none',
                )}
              >
                <Play className={cn('w-4 h-4', isStarting && 'animate-pulse')} />
                {isStarting ? 'Starting…' : 'Start Job'}
              </button>
            </OptaSurface>

            {/* Jobs list */}
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                Jobs ({jobs.length})
              </h2>
              {isLoading && jobs.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">Loading…</p>
              ) : jobs.length === 0 ? (
                <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl text-center">
                  <Package className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">No quantization jobs yet.</p>
                </OptaSurface>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <motion.div
                      key={job.job_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <OptaSurface hierarchy="raised" padding="md" className="rounded-xl space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{job.repo_id}</p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {new Date(job.created_at).toLocaleString()} · Job {job.job_id.slice(0, 8)}
                            </p>
                          </div>
                          <JobStatusPill status={job.status} />
                        </div>
                        {(job.status === 'running' || job.status === 'pending') && job.percent != null && (
                          <div className="space-y-1">
                            <ProgressBar percent={job.percent} />
                            <p className="text-xs text-text-muted text-right">{job.percent.toFixed(0)}%</p>
                          </div>
                        )}
                        {job.status === 'failed' && job.error && (
                          <p className="text-xs text-neon-red">{job.error}</p>
                        )}
                        {job.status === 'completed' && job.output_size_bytes != null && (
                          <p className="text-xs text-text-secondary">
                            Output: {(job.output_size_bytes / 1e9).toFixed(2)} GB
                          </p>
                        )}
                      </OptaSurface>
                    </motion.div>
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
