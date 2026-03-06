'use client'

import {
    Bot,
    Plus,
    XCircle,
    RefreshCw,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    ChevronRight,
    Activity,
    Radio,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import {
    useAgentRun,
    useAgentRunEvents,
    useAgentRuns,
    type AgentRunEvent,
} from '@/hooks/use-agents'
import { createAgentRun, cancelAgentRun } from '@/lib/mutations'
import type { AgentRunStatus, AgentRun } from '@/lib/types'

const STATUS_CONFIG: Record<
    AgentRunStatus,
    { label: string; color: string; icon: React.ElementType }
> = {
    queued: {
        label: 'Queued',
        color: 'text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10',
        icon: Clock,
    },
    running: {
        label: 'Running',
        color: 'text-primary bg-primary/10',
        icon: Loader2,
    },
    completed: {
        label: 'Completed',
        color: 'text-[var(--opta-neon-green)] bg-[var(--opta-neon-green)]/10',
        icon: CheckCircle,
    },
    failed: {
        label: 'Failed',
        color: 'text-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10',
        icon: XCircle,
    },
    cancelled: {
        label: 'Cancelled',
        color: 'text-text-muted bg-[var(--opta-elevated)]',
        icon: XCircle,
    },
}

const EVENT_LABELS: Record<AgentRunEvent['type'], string> = {
    'run.update': 'Run Updated',
    'run.completed': 'Run Completed',
    'run.error': 'Run Error',
    'stream.open': 'Stream Connected',
    'stream.done': 'Stream Closed',
    'stream.error': 'Stream Error',
    message: 'Message',
}

function formatRunTimestamp(ts?: number | null): string {
    if (!ts) return '—'
    const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString()
}

function eventSummary(event: AgentRunEvent): string {
    if (event.type === 'stream.open') return 'Subscribed to run events.'
    if (event.type === 'stream.done') return 'Server sent terminal [DONE] marker.'
    if (event.type === 'stream.error') return 'Connection dropped before terminal event.'

    if (typeof event.data !== 'object' || event.data == null) {
        return typeof event.data === 'string' ? event.data : 'No payload'
    }

    const payload = event.data as {
        error?: string
        code?: string
        run?: {
            status?: AgentRunStatus
            error?: string | null
            steps?: Array<{ status?: AgentRunStatus }>
        }
    }
    const run = payload.run

    if (event.type === 'run.error') {
        return payload.error ?? run?.error ?? 'Run reported an error.'
    }

    if (!run) return 'Lifecycle payload received.'

    const status = run.status ?? 'running'
    const total = run.steps?.length ?? 0
    const completed = (run.steps ?? []).filter(
        s => s.status === 'completed'
    ).length
    const progress = total > 0 ? ` • Steps ${completed}/${total}` : ''

    if (event.type === 'run.completed') {
        return `Final status: ${status}${progress}`
    }
    return `Status: ${status}${progress}`
}

function RunCard({
    run,
    selected,
    isCancelling,
    onSelect,
    onCancel,
}: {
    run: AgentRun
    selected: boolean
    isCancelling: boolean
    onSelect: () => void
    onCancel: (id: string) => void
}) {
    const cfg = STATUS_CONFIG[run.status]
    const Icon = cfg.icon
    const isActive = run.status === 'queued' || run.status === 'running'
    const stepsCompleted = (run.steps ?? []).filter(
        s => s.status === 'completed'
    ).length
    const stepsTotal = (run.steps ?? []).length

    return (
        <div
            className={`config-panel cursor-pointer transition-colors ${selected
                ? 'border-primary/60 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]'
                : 'hover:border-primary/30'
                }`}
            onClick={onSelect}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect()
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open run details ${run.id}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-mono text-text-primary truncate">
                        {run.request?.prompt ?? '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">
                        {run.id.slice(0, 8)}…
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                        className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${cfg.color}`}
                    >
                        <Icon
                            size={11}
                            className={
                                run.status === 'running' ? 'animate-spin' : ''
                            }
                        />
                        {cfg.label}
                    </span>
                    {isActive && (
                        <button
                            onClick={e => {
                                e.stopPropagation()
                                onCancel(run.id)
                            }}
                            disabled={isCancelling}
                            className="p-1 rounded text-text-muted hover:text-[var(--opta-neon-red)] hover:bg-[var(--opta-neon-red)]/10 transition-colors disabled:opacity-50"
                            title="Cancel"
                        >
                            {isCancelling ? (
                                <Loader2 size={13} className="animate-spin" />
                            ) : (
                                <XCircle size={13} />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {stepsTotal > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-muted">Progress</span>
                        <span className="text-[10px] font-mono text-text-muted">
                            {stepsCompleted}/{stepsTotal}
                        </span>
                    </div>
                    <div className="h-1 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                                width: stepsTotal
                                    ? `${(stepsCompleted / stepsTotal) * 100}%`
                                    : '0%',
                            }}
                        />
                    </div>
                </div>
            )}

            {run.steps && run.steps.length > 0 && (
                <div className="space-y-1">
                    {run.steps.slice(-3).map(step => (
                        <div
                            key={step.id}
                            className="flex items-center gap-2 text-xs font-mono text-text-muted"
                        >
                            <ChevronRight
                                size={10}
                                className="text-primary/50"
                            />
                            <span className="truncate">{step.role}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-[rgba(168,85,247,0.15)] flex items-center gap-4 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                <span>
                    model: {run.resolved_model ?? run.request?.model ?? 'auto'}
                </span>
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
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

    const [cancellingId, setCancellingId] = useState<string | null>(null)

    const STATUS_FILTERS: Array<AgentRunStatus | 'all'> = [
        'all',
        'running',
        'queued',
        'completed',
        'failed',
    ]
    const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter)

    useEffect(() => {
        if (filtered.length === 0) {
            setSelectedRunId(null)
            return
        }
        if (!selectedRunId || !filtered.some(r => r.id === selectedRunId)) {
            setSelectedRunId(filtered[0].id)
        }
    }, [filtered, selectedRunId])

    const selectedFromList =
        (selectedRunId ? runs.find(r => r.id === selectedRunId) : null) ?? null
    const {
        run: selectedRunDetails,
        error: runError,
        isLoading: runLoading,
        refresh: refreshRun,
    } = useAgentRun(selectedRunId)
    const selectedRun = selectedRunDetails ?? selectedFromList
    const {
        events: runEvents,
        isStreaming,
        error: eventsError,
        clear: clearEvents,
    } = useAgentRunEvents(selectedRunId)

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
            if (id === selectedRunId) {
                refreshRun()
            }
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setCancellingId(null)
        }
    }

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
                            <span className="text-sm font-mono tracking-wide">
                                Connect to LMX to orchestrate agents.
                            </span>
                        </div>
                    )}

                    <div className="config-panel">
                        <div className="config-title flex items-center gap-2">
                            <Plus size={14} className="text-primary" />
                            New Agent Run
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="config-label">
                                    Goal / Task Description
                                </label>
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
                                <label className="config-label">
                                    Model ID (Optional)
                                </label>
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
                                    disabled={
                                        !isConnected || creating || !prompt.trim()
                                    }
                                    className="holographic-btn w-full flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2
                                                size={14}
                                                className="animate-spin"
                                            />{' '}
                                            Starting…
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={14} /> Start Agent
                                        </>
                                    )}
                                </button>
                                {createError && (
                                    <p className="text-xs text-[var(--opta-neon-red)] font-mono mt-2">
                                        {createError}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Runs + details */}
                <div className="flex-1 grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
                    {/* Runs list */}
                    <div>
                        <div className="flex items-center justify-between mb-4 border-b border-[rgba(168,85,247,0.15)] pb-3">
                            <div className="flex items-center gap-2">
                                <Bot size={15} className="text-text-muted" />
                                <h2 className="text-sm font-mono uppercase tracking-widest text-text-secondary">
                                    Runs{' '}
                                    <span className="text-text-muted ml-1">
                                        ({total})
                                    </span>
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex gap-1 bg-[var(--opta-elevated)] p-1 rounded-lg border border-[rgba(168,85,247,0.15)]">
                                    {STATUS_FILTERS.map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono transition-colors ${filter === f
                                                ? 'bg-primary text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                                : 'text-text-muted hover:text-text-secondary'
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        refresh()
                                        refreshRun()
                                    }}
                                    className="p-1.5 text-text-muted hover:text-primary transition-colors"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-20 gap-2 text-text-muted text-sm font-mono">
                                <Loader2
                                    size={16}
                                    className="animate-spin text-primary"
                                />
                                <span>Loading runs…</span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <Bot
                                    size={32}
                                    className="text-text-muted mb-4 opacity-30"
                                />
                                <p className="text-sm text-text-muted font-mono">
                                    {filter === 'all'
                                        ? 'No agent runs yet.'
                                        : `No ${filter} runs.`}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {filtered.map(run => (
                                    <RunCard
                                        key={run.id}
                                        run={run}
                                        selected={run.id === selectedRunId}
                                        isCancelling={cancellingId === run.id}
                                        onSelect={() =>
                                            setSelectedRunId(run.id)
                                        }
                                        onCancel={handleCancel}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Run details panel */}
                    <div className="config-panel h-fit">
                        <div className="config-title flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Activity size={14} className="text-primary" />
                                Run Details
                            </span>
                            {selectedRunId && (
                                <button
                                    onClick={() => {
                                        refreshRun()
                                        clearEvents()
                                    }}
                                    className="p-1.5 text-text-muted hover:text-primary transition-colors"
                                    title="Refresh run details"
                                >
                                    <RefreshCw size={13} />
                                </button>
                            )}
                        </div>

                        {!selectedRunId ? (
                            <div className="py-10 text-center text-text-muted text-sm font-mono">
                                Select a run to inspect live lifecycle events.
                            </div>
                        ) : runLoading && !selectedRun ? (
                            <div className="flex items-center gap-2 py-8 text-text-muted text-sm font-mono">
                                <Loader2 size={14} className="animate-spin" />
                                Loading run details…
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {runError && (
                                    <div className="p-2 rounded border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 text-xs text-[var(--opta-neon-red)] font-mono">
                                        {(runError as Error).message ??
                                            'Failed to load run details.'}
                                    </div>
                                )}

                                {selectedRun ? (
                                    <>
                                        <div>
                                            <p className="text-sm font-mono text-text-primary break-all">
                                                {selectedRun.request?.prompt ?? '—'}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                {(() => {
                                                    const cfg =
                                                        STATUS_CONFIG[
                                                        selectedRun.status
                                                        ]
                                                    const Icon = cfg.icon
                                                    return (
                                                        <span
                                                            className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${cfg.color}`}
                                                        >
                                                            <Icon
                                                                size={11}
                                                                className={
                                                                    selectedRun.status ===
                                                                        'running'
                                                                        ? 'animate-spin'
                                                                        : ''
                                                                }
                                                            />
                                                            {cfg.label}
                                                        </span>
                                                    )
                                                })()}
                                                {isStreaming && (
                                                    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary">
                                                        <Radio
                                                            size={11}
                                                            className="animate-pulse"
                                                        />
                                                        Live
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                                            <div>
                                                <p className="opacity-70">
                                                    Run ID
                                                </p>
                                                <p className="text-text-secondary break-all normal-case tracking-normal mt-1">
                                                    {selectedRun.id}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Model
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {selectedRun.resolved_model ??
                                                        selectedRun.request?.model ??
                                                        'auto'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Created
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {formatRunTimestamp(
                                                        selectedRun.created_at
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Updated
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {formatRunTimestamp(
                                                        selectedRun.updated_at
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {selectedRun.error && (
                                            <div className="p-2 rounded border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 text-xs text-[var(--opta-neon-red)] font-mono">
                                                {selectedRun.error}
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-2">
                                                Steps ({selectedRun.steps.length})
                                            </h3>
                                            {selectedRun.steps.length === 0 ? (
                                                <p className="text-xs text-text-muted font-mono">
                                                    No step data yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                    {selectedRun.steps.map(
                                                        step => {
                                                            const cfg =
                                                                STATUS_CONFIG[
                                                                step.status
                                                                ]
                                                            const Icon =
                                                                cfg.icon
                                                            return (
                                                                <div
                                                                    key={step.id}
                                                                    className="flex items-center justify-between text-xs border border-[rgba(168,85,247,0.15)] rounded px-2 py-1.5"
                                                                >
                                                                    <div className="min-w-0 mr-3">
                                                                        <p className="font-mono text-text-primary truncate">
                                                                            {
                                                                                step.role
                                                                            }
                                                                        </p>
                                                                        {step.error && (
                                                                            <p className="text-[10px] text-[var(--opta-neon-red)] font-mono truncate mt-0.5">
                                                                                {
                                                                                    step.error
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <span
                                                                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${cfg.color}`}
                                                                    >
                                                                        <Icon
                                                                            size={
                                                                                10
                                                                            }
                                                                            className={
                                                                                step.status ===
                                                                                    'running'
                                                                                    ? 'animate-spin'
                                                                                    : ''
                                                                            }
                                                                        />
                                                                        {
                                                                            cfg.label
                                                                        }
                                                                    </span>
                                                                </div>
                                                            )
                                                        }
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-text-muted font-mono">
                                        Run snapshot unavailable.
                                    </p>
                                )}

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary">
                                            Live Event Timeline
                                        </h3>
                                        <span className="text-[10px] text-text-muted font-mono">
                                            {runEvents.length} events
                                        </span>
                                    </div>
                                    {eventsError && (
                                        <div className="mb-2 p-2 rounded border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 text-xs text-[var(--opta-neon-red)] font-mono">
                                            {eventsError}
                                        </div>
                                    )}
                                    {runEvents.length === 0 ? (
                                        <p className="text-xs text-text-muted font-mono">
                                            Waiting for run lifecycle updates…
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {runEvents
                                                .slice()
                                                .reverse()
                                                .map(event => (
                                                    <div
                                                        key={event.id}
                                                        className="border border-[rgba(168,85,247,0.12)] rounded px-2 py-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                                                                {
                                                                    EVENT_LABELS[
                                                                    event.type
                                                                    ]
                                                                }
                                                            </span>
                                                            <span className="text-[10px] font-mono text-text-muted">
                                                                {new Date(
                                                                    event.timestamp
                                                                ).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-mono text-text-secondary mt-1 leading-relaxed">
                                                            {eventSummary(event)}
                                                        </p>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
