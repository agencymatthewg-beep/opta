'use client'

import { Bot, Plus, XCircle, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useConnection } from '@/lib/connection'
import { useAgentRuns } from '@/hooks/use-agents'
import { createAgentRun, cancelAgentRun } from '@/lib/mutations'
import type { AgentRunStatus, AgentRun } from '@/lib/types'

function PageHeader({ title, subtitle, icon: Icon }: {
    title: string; subtitle: string; icon: React.ElementType
}) {
    return (
        <div className="border-b border-[var(--opta-border)] px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                </div>
                <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            <p className="text-sm text-text-secondary ml-12">{subtitle}</p>
        </div>
    )
}

const STATUS_CONFIG: Record<AgentRunStatus, { label: string; color: string; icon: React.ElementType }> = {
    queued: { label: 'Queued', color: 'text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10', icon: Clock },
    running: { label: 'Running', color: 'text-primary bg-primary/10', icon: Loader2 },
    completed: { label: 'Completed', color: 'text-[var(--opta-neon-green)] bg-[var(--opta-neon-green)]/10', icon: CheckCircle },
    failed: { label: 'Failed', color: 'text-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'text-text-muted bg-[var(--opta-elevated)]', icon: XCircle },
}

function RunCard({ run, onCancel }: { run: AgentRun; onCancel: (id: string) => void }) {
    const cfg = STATUS_CONFIG[run.status]
    const Icon = cfg.icon
    const isActive = run.status === 'queued' || run.status === 'running'
    const stepsCompleted = (run.steps ?? []).filter(s => s.status === 'completed').length
    const stepsTotal = (run.steps ?? []).length

    return (
        <div className="dashboard-card">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-mono text-text-primary truncate">{run.request?.prompt ?? '—'}</p>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">{run.id.slice(0, 8)}…</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-mono ${cfg.color}`}>
                        <Icon size={11} className={run.status === 'running' ? 'animate-spin' : ''} />
                        {cfg.label}
                    </span>
                    {isActive && (
                        <button onClick={() => onCancel(run.id)}
                            className="p-1 rounded text-text-muted hover:text-[var(--opta-neon-red)] hover:bg-[var(--opta-neon-red)]/10 transition-colors"
                            title="Cancel">
                            <XCircle size={13} />
                        </button>
                    )}
                </div>
            </div>

            {stepsTotal > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-muted">Progress</span>
                        <span className="text-xs font-mono text-text-muted">{stepsCompleted}/{stepsTotal}</span>
                    </div>
                    <div className="h-1 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: stepsTotal ? `${(stepsCompleted / stepsTotal) * 100}%` : '0%' }}
                        />
                    </div>
                </div>
            )}

            {run.steps && run.steps.length > 0 && (
                <div className="space-y-1">
                    {run.steps.slice(-3).map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono text-text-muted">
                            <ChevronRight size={10} />
                            <span className="truncate">{step.role}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-[var(--opta-border)] flex items-center gap-4 text-xs font-mono text-text-muted">
                <span>model: {run.resolved_model ?? run.request?.model ?? 'auto'}</span>
            </div>
        </div>
    )
}

export default function AgentsPage() {
    const { isConnected } = useConnection()
    const { runs, total, isLoading, refresh } = useAgentRuns()

    // Create form
    const [prompt, setPrompt] = useState('')
    const [modelId, setModelId] = useState('')
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    // Filter
    const [filter, setFilter] = useState<AgentRunStatus | 'all'>('all')

    const [cancellingId, setCancellingId] = useState<string | null>(null)

    async function handleCreate() {
        if (!prompt.trim()) return
        setCreating(true)
        setCreateError(null)
        try {
            await createAgentRun({
                request: {
                    prompt: prompt.trim(),
                    model: modelId || undefined,
                },
            })
            setPrompt('')
            refresh()
        } catch (e) {
            setCreateError((e as Error).message)
        } finally {
            setCreating(false)
        }
    }

    async function handleCancel(id: string) {
        setCancellingId(id)
        try {
            await cancelAgentRun(id)
            refresh()
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setCancellingId(null)
        }
    }

    const STATUS_FILTERS: Array<AgentRunStatus | 'all'> = ['all', 'running', 'queued', 'completed', 'failed']
    const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter)

    return (
        <DashboardLayout>
            <PageHeader
                title="Agents"
                subtitle="Create and monitor multi-step agent runs"
                icon={Bot}
            />

            <div className="px-8 py-6 space-y-6">
                {!isConnected && (
                    <div className="dashboard-card flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to orchestrate agents.</span>
                    </div>
                )}

                {/* Create run */}
                <div className="dashboard-card">
                    <div className="flex items-center gap-2 mb-5">
                        <Plus size={16} className="text-primary" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">New Agent Run</h2>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-text-muted mb-1 block">Goal / task description</label>
                            <textarea
                                className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-muted"
                                rows={3}
                                placeholder="Describe what the agent should accomplish…"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                disabled={!isConnected || creating}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-1">
                                <label className="text-xs text-text-muted mb-1 block">Model ID (optional)</label>
                                <input
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                                    placeholder="default model"
                                    value={modelId}
                                    onChange={e => setModelId(e.target.value)}
                                    disabled={!isConnected || creating}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCreate}
                                disabled={!isConnected || creating || !prompt.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus size={14} />
                                {creating ? 'Starting…' : 'Start Agent'}
                            </button>
                            {createError && <p className="text-xs text-[var(--opta-neon-red)] font-mono">{createError}</p>}
                        </div>
                    </div>
                </div>

                {/* Runs list */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Bot size={15} className="text-text-muted" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                                Runs <span className="font-mono text-text-muted ml-1">({total})</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {STATUS_FILTERS.map(f => (
                                    <button key={f} onClick={() => setFilter(f)}
                                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${filter === f ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => refresh()} className="p-1.5 text-text-muted hover:text-text-secondary transition-colors">
                                <RefreshCw size={13} />
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-2 text-text-muted text-sm">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading runs…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="dashboard-card text-center py-10 text-text-muted">
                            <Bot size={28} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">{filter === 'all' ? 'No agent runs yet.' : `No ${filter} runs.`}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filtered.map(run => (
                                <RunCard key={run.id} run={run} onCancel={handleCancel} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
