'use client'

import { Bot, Plus, XCircle, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useAgentRuns } from '@/hooks/use-agents'
import { createAgentRun, cancelAgentRun } from '@/lib/mutations'
import type { AgentRunStatus, AgentRun } from '@/lib/types'

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
        <div className="config-panel">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-mono text-text-primary truncate">{run.request?.prompt ?? '—'}</p>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">{run.id.slice(0, 8)}…</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${cfg.color}`}>
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
                        <span className="text-[10px] font-mono text-text-muted">{stepsCompleted}/{stepsTotal}</span>
                    </div>
                    <div className="h-1 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: stepsTotal ? `${(stepsCompleted / stepsTotal) * 100}%` : '0%' }}
                        />
                    </div>
                </div>
            )}

            {run.steps && run.steps.length > 0 && (
                <div className="space-y-1">
                    {run.steps.slice(-3).map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono text-text-muted">
                            <ChevronRight size={10} className="text-primary/50" />
                            <span className="truncate">{step.role}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-[rgba(168,85,247,0.15)] flex items-center gap-4 text-[10px] font-mono text-text-muted uppercase tracking-wider">
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

            <div className="px-8 py-6 space-y-6 hud-fade-in flex flex-col lg:flex-row gap-6">

                {/* Create run panel (Left sidebar in large views) */}
                <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
                    {!isConnected && (
                        <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                            <AlertCircle size={16} />
                            <span className="text-sm font-mono tracking-wide">Connect to LMX to orchestrate agents.</span>
                        </div>
                    )}

                    <div className="config-panel">
                        <div className="config-title flex items-center gap-2">
                            <Plus size={14} className="text-primary" />
                            New Agent Run
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="config-label">Goal / Task Description</label>
                                <textarea
                                    className="holographic-input resize-none w-full"
                                    rows={4}
                                    placeholder="Describe what the agent should accomplish…"
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    disabled={!isConnected || creating}
                                />
                            </div>
                            <div>
                                <label className="config-label">Model ID (Optional)</label>
                                <input
                                    className="holographic-input w-full"
                                    placeholder="default model"
                                    value={modelId}
                                    onChange={e => setModelId(e.target.value)}
                                    disabled={!isConnected || creating}
                                />
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={!isConnected || creating || !prompt.trim()}
                                    className="holographic-btn w-full flex items-center justify-center gap-2"
                                >
                                    {creating ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><Plus size={14} /> Start Agent</>}
                                </button>
                                {createError && <p className="text-xs text-[var(--opta-neon-red)] font-mono mt-2">{createError}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Runs list (main area) */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4 border-b border-[rgba(168,85,247,0.15)] pb-3">
                        <div className="flex items-center gap-2">
                            <Bot size={15} className="text-text-muted" />
                            <h2 className="text-sm font-mono uppercase tracking-widest text-text-secondary">
                                Runs <span className="text-text-muted ml-1">({total})</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex gap-1 bg-[var(--opta-elevated)] p-1 rounded-lg border border-[rgba(168,85,247,0.15)]">
                                {STATUS_FILTERS.map(f => (
                                    <button key={f} onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono transition-colors ${filter === f ? 'bg-primary text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'text-text-muted hover:text-text-secondary'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => refresh()} className="p-1.5 text-text-muted hover:text-primary transition-colors">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20 gap-2 text-text-muted text-sm font-mono">
                            <Loader2 size={16} className="animate-spin text-primary" />
                            <span>Loading runs…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Bot size={32} className="text-text-muted mb-4 opacity-30" />
                            <p className="text-sm text-text-muted font-mono">{filter === 'all' ? 'No agent runs yet.' : `No ${filter} runs.`}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
