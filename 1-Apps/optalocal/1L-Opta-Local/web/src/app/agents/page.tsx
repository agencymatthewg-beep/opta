'use client';

/**
 * Agents Page — LMX Agent Runs management.
 *
 * Lists server-side agent runs from the LMX API, allows creating new runs,
 * and supports cancelling in-progress ones. Auto-refreshes every 3s while
 * any run is in pending/running state.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Play,
  StopCircle,
  RefreshCw,
  ChevronRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import { useModels } from '@/hooks/useModels';
import type { AgentRun, AgentRunCreate, AgentRunStatus } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: AgentRunStatus): React.ReactNode {
  switch (status) {
    case 'pending':  return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    case 'running':  return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'failed':   return <XCircle className="w-3.5 h-3.5 text-neon-red" />;
    case 'cancelled': return <StopCircle className="w-3.5 h-3.5 text-text-muted" />;
    default:          return null;
  }
}

function statusPillStatus(status: AgentRunStatus): 'neutral' | 'info' | 'success' | 'danger' | 'warning' {
  switch (status) {
    case 'pending':   return 'warning';
    case 'running':   return 'info';
    case 'completed': return 'success';
    case 'failed':    return 'danger';
    case 'cancelled': return 'neutral';
    default:          return 'neutral';
  }
}

function isActive(status: AgentRunStatus): boolean {
  return status === 'pending' || status === 'running';
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

interface CreateRunFormProps {
  models: Array<{ id: string }>;
  onSubmit: (payload: AgentRunCreate) => Promise<void>;
  isSubmitting: boolean;
}

function CreateRunForm({ models, onSubmit, isSubmitting }: CreateRunFormProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(models[0]?.id ?? '');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxTurns, setMaxTurns] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync model when models list loads
  useEffect(() => {
    if (!model && models[0]) setModel(models[0].id);
  }, [models, model]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const payload: AgentRunCreate = {
      input: input.trim(),
      max_turns: maxTurns,
    };
    if (model) payload.model = model;
    if (systemPrompt.trim()) payload.system_prompt = systemPrompt.trim();
    void onSubmit(payload).then(() => { setInput(''); });
  }, [input, model, systemPrompt, maxTurns, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-text-muted block mb-1">Input</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={isSubmitting}
          placeholder="What should the agent do?"
          className={cn(
            'w-full rounded-xl px-3 py-2 text-sm',
            'bg-opta-surface text-text-primary placeholder:text-text-muted',
            'border border-opta-border outline-none resize-none',
            'disabled:opacity-50',
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isSubmitting}
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
          <label className="text-xs font-medium text-text-muted block mb-1">Max turns</label>
          <input
            type="number"
            min={1}
            max={50}
            value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))}
            disabled={isSubmitting}
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
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        {showAdvanced ? '▴ Hide advanced' : '▸ Advanced options'}
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <label className="text-xs font-medium text-text-muted block mb-1">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              disabled={isSubmitting}
              placeholder="Optional system instructions…"
              className={cn(
                'w-full rounded-xl px-3 py-2 text-sm',
                'bg-opta-surface text-text-primary placeholder:text-text-muted',
                'border border-opta-border outline-none resize-none',
                'disabled:opacity-50',
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={isSubmitting || !input.trim()}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          'bg-primary/15 text-primary hover:bg-primary/25',
          'disabled:opacity-50 disabled:pointer-events-none',
        )}
      >
        <Play className={cn('w-4 h-4', isSubmitting && 'animate-pulse')} />
        {isSubmitting ? 'Starting…' : 'Run Agent'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Run detail panel
// ---------------------------------------------------------------------------

interface RunDetailProps {
  run: AgentRun;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}

function RunDetail({ run, onCancel, isCancelling }: RunDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Run {run.id.slice(0, 8)}…</h3>
        <OptaStatusPill label={run.status} status={statusPillStatus(run.status)} />
      </div>

      <dl className="space-y-2 text-xs">
        {run.model && (
          <div className="flex justify-between">
            <dt className="text-text-muted">Model</dt>
            <dd className="font-mono text-text-primary">{run.model}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-text-muted">Created</dt>
          <dd className="text-text-secondary">{new Date(run.created_at).toLocaleString()}</dd>
        </div>
        {run.updated_at && (
          <div className="flex justify-between">
            <dt className="text-text-muted">Updated</dt>
            <dd className="text-text-secondary">{new Date(run.updated_at).toLocaleString()}</dd>
          </div>
        )}
        {run.max_turns != null && (
          <div className="flex justify-between">
            <dt className="text-text-muted">Max turns</dt>
            <dd className="text-text-primary">{run.max_turns}</dd>
          </div>
        )}
      </dl>

      {run.input && (
        <div>
          <p className="text-xs font-medium text-text-muted mb-1">Input</p>
          <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono bg-opta-surface/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {run.input}
          </pre>
        </div>
      )}

      {run.output && (
        <div>
          <p className="text-xs font-medium text-text-muted mb-1">Output</p>
          <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono bg-opta-surface/50 rounded-lg p-3 max-h-64 overflow-y-auto">
            {run.output}
          </pre>
        </div>
      )}

      {run.error && (
        <div className="rounded-lg border border-neon-red/20 bg-neon-red/5 p-3">
          <p className="text-xs text-neon-red">{run.error}</p>
        </div>
      )}

      {isActive(run.status) && (
        <button
          onClick={() => void onCancel(run.id)}
          disabled={isCancelling}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            'bg-neon-red/10 text-neon-red hover:bg-neon-red/20',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          <StopCircle className="w-3.5 h-3.5" />
          {isCancelling ? 'Cancelling…' : 'Cancel run'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const { models } = useModels(client);

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasActiveRuns = useRef(false);

  const fetchRuns = useCallback(async (silent = false) => {
    if (!client) return;
    if (!silent) setIsLoading(true);
    try {
      const data = await client.listAgentRuns();
      setRuns(data);
      hasActiveRuns.current = data.some((r) => isActive(r.status));
      // Update selected run if visible
      if (selectedRun) {
        const updated = data.find((r) => r.id === selectedRun.id);
        if (updated) setSelectedRun(updated);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load runs');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [client, selectedRun]);

  // Initial load
  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  // Auto-refresh every 3s while active runs exist
  useEffect(() => {
    const id = setInterval(() => {
      if (hasActiveRuns.current) void fetchRuns(true);
    }, 3000);
    return () => clearInterval(id);
  }, [fetchRuns]);

  const handleCreate = useCallback(async (payload: AgentRunCreate) => {
    if (!client) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const run = await client.createAgentRun(payload);
      setRuns((prev) => [run, ...prev]);
      hasActiveRuns.current = true;
      setSelectedRun(run);
      setView('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create run');
    } finally {
      setIsSubmitting(false);
    }
  }, [client]);

  const handleCancel = useCallback(async (runId: string) => {
    if (!client) return;
    setIsCancelling(true);
    setError(null);
    try {
      const updated = await client.cancelAgentRun(runId);
      setRuns((prev) => prev.map((r) => r.id === runId ? updated : r));
      setSelectedRun(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel run');
    } finally {
      setIsCancelling(false);
    }
  }, [client]);

  const handleSelectRun = useCallback(async (run: AgentRun) => {
    setSelectedRun(run);
    // Fetch fresh detail if run is active
    if (!client || !isActive(run.status)) return;
    try {
      const detail = await client.getAgentRun(run.id);
      setSelectedRun(detail);
    } catch {
      // Keep existing data
    }
  }, [client]);

  return (
    <main className="min-h-screen p-6">
      {/* Page header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
            <Workflow className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Agent Runs</h1>
            <p className="text-sm text-text-secondary">
              Server-side agent executions — runs locally, no API costs.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchRuns()}
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
          <button
            onClick={() => setView((v) => v === 'create' ? 'list' : 'create')}
            disabled={!client}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === 'create'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            <PlusCircle className="w-4 h-4" />
            New Run
          </button>
        </div>
      </header>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!client ? (
        <p className="text-sm text-text-muted text-center pt-12">
          Not connected — check Settings to configure your server.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: run list */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
              Runs ({runs.length})
            </h2>

            {isLoading && runs.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">Loading…</p>
            )}

            {!isLoading && runs.length === 0 && (
              <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl text-center">
                <Workflow className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No agent runs yet.</p>
                <button
                  onClick={() => setView('create')}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Create your first run →
                </button>
              </OptaSurface>
            )}

            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => void handleSelectRun(run)}
                className={cn(
                  'w-full text-left rounded-xl p-3 transition-all border',
                  selectedRun?.id === run.id
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-transparent glass-subtle hover:border-opta-border',
                )}
              >
                <div className="flex items-center gap-2">
                  {statusIcon(run.status)}
                  <span className="text-xs font-mono text-text-secondary truncate flex-1">
                    {run.id.slice(0, 12)}…
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                </div>
                {run.input && (
                  <p className="mt-1.5 text-xs text-text-secondary truncate">
                    {run.input.slice(0, 60)}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <OptaStatusPill label={run.status} status={statusPillStatus(run.status)} />
                  <span className="text-[10px] text-text-muted">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right: detail / create */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {view === 'create' ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.15 }}
                >
                  <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-text-primary">New Agent Run</h2>
                      <button
                        onClick={() => setView('list')}
                        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                    <CreateRunForm
                      models={models}
                      onSubmit={handleCreate}
                      isSubmitting={isSubmitting}
                    />
                  </OptaSurface>
                </motion.div>
              ) : selectedRun ? (
                <motion.div
                  key={selectedRun.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.15 }}
                >
                  <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl">
                    <RunDetail
                      run={selectedRun}
                      onCancel={handleCancel}
                      isCancelling={isCancelling}
                    />
                  </OptaSurface>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <OptaSurface hierarchy="raised" padding="lg" className="rounded-xl h-full flex flex-col items-center justify-center min-h-48 text-center">
                    <Workflow className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-text-muted mb-3">Select a run to view details</p>
                    <button
                      onClick={() => setView('create')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        'bg-primary/10 text-primary hover:bg-primary/20',
                      )}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      New Run
                    </button>
                  </OptaSurface>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </main>
  );
}
