'use client'

import {
    AlertCircle,
    Binary,
    CheckCircle2,
    Clock3,
    Loader2,
    RefreshCw,
    Square,
    XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ElementType } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useAvailableModels, useLoadedModels } from '@/hooks/use-models'
import {
    cancelQuantizeJob,
    isQuantizeJobActive,
    startQuantizeJob,
    type QuantizeJob,
    type QuantizeJobStatus,
    useQuantizeJob,
    useQuantizeJobs,
} from '@/hooks/use-quantize'
import { useConnection } from '@/lib/connection'

type QuantizeMode = 'affine' | 'mxfp4' | 'mxfp8' | 'nvfp4'

const MODE_OPTIONS: Record<
    QuantizeMode,
    { bits: number[]; groupSizes: number[]; hint: string }
> = {
    affine: {
        bits: [2, 3, 4, 5, 6, 8],
        groupSizes: [32, 64, 128],
        hint: 'General-purpose integer quantization.',
    },
    mxfp4: {
        bits: [4],
        groupSizes: [32],
        hint: '4-bit MX floating-point quantization.',
    },
    mxfp8: {
        bits: [8],
        groupSizes: [32],
        hint: '8-bit MX floating-point quantization.',
    },
    nvfp4: {
        bits: [4],
        groupSizes: [16],
        hint: 'NVIDIA FP4-compatible quantization.',
    },
}

const STATUS_META: Record<
    QuantizeJobStatus,
    { label: string; color: string; icon: ElementType }
> = {
    pending: {
        label: 'Pending',
        color: 'text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10',
        icon: Clock3,
    },
    queued: {
        label: 'Queued',
        color: 'text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10',
        icon: Clock3,
    },
    running: {
        label: 'Running',
        color: 'text-primary bg-primary/10',
        icon: Loader2,
    },
    cancelling: {
        label: 'Cancelling',
        color: 'text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10',
        icon: Loader2,
    },
    completed: {
        label: 'Completed',
        color: 'text-[var(--opta-neon-green)] bg-[var(--opta-neon-green)]/10',
        icon: CheckCircle2,
    },
    failed: {
        label: 'Failed',
        color: 'text-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10',
        icon: XCircle,
    },
    cancelled: {
        label: 'Cancelled',
        color: 'text-text-muted bg-[var(--opta-elevated)]',
        icon: Square,
    },
}

function formatTimestamp(ts?: number | null): string {
    if (ts == null || ts <= 0) return '—'
    return new Date(ts * 1000).toLocaleString()
}

function formatDuration(job: QuantizeJob | null): string {
    if (!job) return '—'
    if (typeof job.duration_sec === 'number' && Number.isFinite(job.duration_sec)) {
        return `${job.duration_sec.toFixed(1)}s`
    }
    if (!job.started_at) return '—'
    const end = job.completed_at ?? Date.now() / 1000
    const sec = Math.max(0, end - job.started_at)
    return `${sec.toFixed(1)}s`
}

function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '—'
    const gb = bytes / (1024 ** 3)
    if (gb >= 1) return `${gb.toFixed(2)} GB`
    const mb = bytes / (1024 ** 2)
    return `${mb.toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string }) {
    const key = (status in STATUS_META ? status : 'queued') as QuantizeJobStatus
    const meta = STATUS_META[key]
    const Icon = meta.icon
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${meta.color}`}
        >
            <Icon
                size={11}
                className={status === 'running' || status === 'cancelling' ? 'animate-spin' : ''}
            />
            {meta.label}
        </span>
    )
}

export default function QuantizePage() {
    const { isConnected } = useConnection()
    const { models: loadedModels } = useLoadedModels()
    const { available } = useAvailableModels()
    const { jobs, total, isLoading, refresh: refreshJobs } = useQuantizeJobs()

    const [sourceModel, setSourceModel] = useState('')
    const [outputPath, setOutputPath] = useState('')
    const [mode, setMode] = useState<QuantizeMode>('affine')
    const [bits, setBits] = useState(4)
    const [groupSize, setGroupSize] = useState(64)
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
    const [starting, setStarting] = useState(false)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [actionMessage, setActionMessage] = useState<string | null>(null)

    const {
        job: selectedJobDetail,
        isLoading: selectedLoading,
        refresh: refreshSelected,
    } = useQuantizeJob(selectedJobId)

    const selectedJob =
        selectedJobDetail ??
        jobs.find((job) => job.job_id === selectedJobId) ??
        null

    const modeConfig = MODE_OPTIONS[mode]

    const modelCandidates = useMemo(() => {
        const unique = new Set<string>()
        for (const model of loadedModels ?? []) unique.add(model.model_id)
        for (const model of available ?? []) unique.add(model.repo_id)
        return Array.from(unique).sort((a, b) => a.localeCompare(b))
    }, [loadedModels, available])

    useEffect(() => {
        if (!modeConfig.bits.includes(bits)) setBits(modeConfig.bits[0])
        if (!modeConfig.groupSizes.includes(groupSize)) {
            setGroupSize(modeConfig.groupSizes[0])
        }
    }, [modeConfig, bits, groupSize])

    useEffect(() => {
        if (!selectedJobId && jobs.length > 0) {
            setSelectedJobId(jobs[0].job_id)
        }
    }, [jobs, selectedJobId])

    async function handleStart() {
        if (!sourceModel.trim()) return
        setStarting(true)
        setActionError(null)
        setActionMessage(null)
        try {
            const started = await startQuantizeJob({
                source_model: sourceModel.trim(),
                output_path: outputPath.trim() || undefined,
                bits,
                group_size: groupSize,
                mode,
            })
            setSelectedJobId(started.job_id)
            setActionMessage(
                `Quantize job queued (${started.job_id.slice(0, 8)}…).`
            )
            refreshJobs()
        } catch (err) {
            setActionError((err as Error).message)
        } finally {
            setStarting(false)
        }
    }

    async function handleCancel(jobId: string) {
        setCancellingId(jobId)
        setActionError(null)
        setActionMessage(null)
        try {
            const result = await cancelQuantizeJob(jobId)
            if (result.cancelled) {
                setActionMessage(`Cancelled ${jobId}.`)
            } else if (result.reason === 'cancelling') {
                setActionMessage(`Cancellation requested for ${jobId}.`)
            } else {
                setActionMessage(`Cancel response: ${result.reason}.`)
            }
            refreshJobs()
            if (selectedJobId === jobId) refreshSelected()
        } catch (err) {
            setActionError((err as Error).message)
        } finally {
            setCancellingId(null)
        }
    }

    const activeCount = jobs.filter((job) =>
        isQuantizeJobActive(job.status)
    ).length

    return (
        <DashboardLayout>
            <PageHeader
                title="Quantize"
                subtitle="Start quantization jobs and track lifecycle in real time"
                icon={Binary}
                action={
                    <button
                        onClick={() => {
                            refreshJobs()
                            refreshSelected()
                        }}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">
                            Connect to LMX to run quantization jobs.
                        </span>
                    </div>
                )}

                {(actionError || actionMessage) && (
                    <div
                        className={`config-panel flex items-center gap-3 ${actionError
                            ? 'text-[var(--opta-neon-red)]'
                            : 'text-[var(--opta-neon-green)]'
                            }`}
                    >
                        {actionError ? (
                            <AlertCircle size={16} />
                        ) : (
                            <CheckCircle2 size={16} />
                        )}
                        <span className="text-sm font-mono">
                            {actionError ?? actionMessage}
                        </span>
                    </div>
                )}

                <div className="config-panel">
                    <div className="config-title">Start Quantize Job</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <p className="config-label">Source Model</p>
                            <input
                                list="quantize-model-candidates"
                                className="holographic-input"
                                placeholder="mlx-community/Qwen2.5-7B-Instruct-4bit"
                                value={sourceModel}
                                onChange={(event) =>
                                    setSourceModel(event.target.value)
                                }
                                disabled={!isConnected || starting}
                            />
                            <datalist id="quantize-model-candidates">
                                {modelCandidates.map((modelId) => (
                                    <option key={modelId} value={modelId} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <p className="config-label">Mode</p>
                            <select
                                className="holographic-input"
                                value={mode}
                                onChange={(event) =>
                                    setMode(event.target.value as QuantizeMode)
                                }
                                disabled={!isConnected || starting}
                            >
                                {Object.keys(MODE_OPTIONS).map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <p className="config-label">Bits</p>
                            <select
                                className="holographic-input"
                                value={bits}
                                onChange={(event) =>
                                    setBits(Number(event.target.value))
                                }
                                disabled={!isConnected || starting}
                            >
                                {modeConfig.bits.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <p className="config-label">Group Size</p>
                            <select
                                className="holographic-input"
                                value={groupSize}
                                onChange={(event) =>
                                    setGroupSize(Number(event.target.value))
                                }
                                disabled={!isConnected || starting}
                            >
                                {modeConfig.groupSizes.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <p className="config-label">Output Path (Optional)</p>
                            <input
                                className="holographic-input"
                                placeholder="~/.opta-lmx/quantized/my-model-q4"
                                value={outputPath}
                                onChange={(event) =>
                                    setOutputPath(event.target.value)
                                }
                                disabled={!isConnected || starting}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleStart}
                                disabled={
                                    !isConnected ||
                                    starting ||
                                    !sourceModel.trim()
                                }
                                className="holographic-btn w-full flex items-center justify-center gap-2"
                            >
                                {starting ? (
                                    <>
                                        <Loader2
                                            size={12}
                                            className="animate-spin"
                                        />
                                        Starting…
                                    </>
                                ) : (
                                    <>Queue Quantize Job</>
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-text-muted font-mono mt-3">
                        {modeConfig.hint}
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="config-panel">
                        <div className="config-title flex items-center justify-between">
                            <span>Jobs ({total})</span>
                            <span className="text-[10px] font-mono text-text-muted">
                                Active: {activeCount}
                            </span>
                        </div>

                        {isLoading && jobs.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                                <Loader2 size={14} className="animate-spin" />
                                Loading jobs…
                            </div>
                        ) : jobs.length === 0 ? (
                            <p className="text-sm text-text-muted font-mono">
                                No quantize jobs yet.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-[520px] overflow-y-auto">
                                {jobs.map((job) => {
                                    const selected =
                                        selectedJobId === job.job_id
                                    const active = isQuantizeJobActive(
                                        job.status
                                    )
                                    return (
                                        <div
                                            key={job.job_id}
                                            onClick={() =>
                                                setSelectedJobId(job.job_id)
                                            }
                                            className={`rounded-lg border p-3 cursor-pointer transition-colors ${selected
                                                ? 'border-primary/50 bg-primary/10'
                                                : 'border-[rgba(168,85,247,0.15)] hover:border-primary/30'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-mono text-text-primary truncate">
                                                        {job.source_model}
                                                    </p>
                                                    <p className="text-[11px] text-text-muted font-mono mt-0.5">
                                                        {job.mode ?? 'affine'} ·{' '}
                                                        {job.bits}-bit · g
                                                        {job.group_size ?? '—'}
                                                    </p>
                                                    <p className="text-[10px] text-text-muted font-mono mt-1">
                                                        {job.job_id}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <StatusBadge
                                                        status={job.status}
                                                    />
                                                    {active && (
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleCancel(
                                                                    job.job_id
                                                                )
                                                            }}
                                                            disabled={
                                                                cancellingId ===
                                                                job.job_id
                                                            }
                                                            className="text-xs font-mono px-2 py-1 rounded border border-[var(--opta-neon-red)]/40 text-[var(--opta-neon-red)] hover:bg-[var(--opta-neon-red)]/10 transition-colors"
                                                        >
                                                            {cancellingId ===
                                                                job.job_id ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Loader2
                                                                        size={10}
                                                                        className="animate-spin"
                                                                    />
                                                                    Cancel…
                                                                </span>
                                                            ) : (
                                                                'Cancel'
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {job.queue_position != null &&
                                                job.queue_position > 0 && (
                                                    <p className="text-[10px] font-mono text-text-muted mt-2">
                                                        Queue position:{' '}
                                                        {job.queue_position}
                                                    </p>
                                                )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="config-panel">
                        <div className="config-title flex items-center justify-between">
                            <span>Selected Job</span>
                            {selectedLoading && (
                                <Loader2
                                    size={12}
                                    className="animate-spin text-text-muted"
                                />
                            )}
                        </div>

                        {!selectedJob ? (
                            <p className="text-sm text-text-muted font-mono">
                                Select a job to view detail.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-mono text-sm text-text-primary break-all">
                                            {selectedJob.job_id}
                                        </p>
                                        <p className="text-xs font-mono text-text-muted mt-1 break-all">
                                            {selectedJob.source_model}
                                        </p>
                                    </div>
                                    <StatusBadge status={selectedJob.status} />
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                    <div>
                                        <p className="config-label">Mode</p>
                                        <p>{selectedJob.mode ?? 'affine'}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Bits</p>
                                        <p>{selectedJob.bits}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">
                                            Group Size
                                        </p>
                                        <p>{selectedJob.group_size ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">
                                            Queue Position
                                        </p>
                                        <p>{selectedJob.queue_position ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Started</p>
                                        <p>
                                            {formatTimestamp(
                                                selectedJob.started_at
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="config-label">Finished</p>
                                        <p>
                                            {formatTimestamp(
                                                selectedJob.completed_at ??
                                                selectedJob.cancelled_at
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="config-label">Duration</p>
                                        <p>{formatDuration(selectedJob)}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">
                                            Output Size
                                        </p>
                                        <p>
                                            {formatBytes(
                                                selectedJob.output_size_bytes
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="config-label">
                                        Output Path
                                    </p>
                                    <p className="text-xs font-mono text-text-secondary break-all">
                                        {selectedJob.output_path ?? '—'}
                                    </p>
                                </div>

                                {selectedJob.error && (
                                    <div className="rounded-md border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 p-3 text-[var(--opta-neon-red)]">
                                        <p className="text-xs font-mono break-words">
                                            {selectedJob.error}
                                        </p>
                                    </div>
                                )}

                                {(selectedJob.failure_code ||
                                    selectedJob.exit_code != null ||
                                    selectedJob.signal != null) && (
                                        <div className="text-xs font-mono text-text-muted space-y-1">
                                            <p>
                                                failure_code:{' '}
                                                {selectedJob.failure_code ??
                                                    '—'}
                                            </p>
                                            <p>
                                                exit_code:{' '}
                                                {selectedJob.exit_code ?? '—'}
                                            </p>
                                            <p>
                                                signal:{' '}
                                                {selectedJob.signal ?? '—'}
                                            </p>
                                            <p>
                                                worker_pid:{' '}
                                                {selectedJob.worker_pid ?? '—'}
                                            </p>
                                        </div>
                                    )}

                                {isQuantizeJobActive(selectedJob.status) && (
                                    <button
                                        onClick={() =>
                                            handleCancel(selectedJob.job_id)
                                        }
                                        disabled={
                                            cancellingId === selectedJob.job_id
                                        }
                                        className="holographic-btn w-full flex items-center justify-center gap-2"
                                    >
                                        {cancellingId === selectedJob.job_id ? (
                                            <>
                                                <Loader2
                                                    size={12}
                                                    className="animate-spin"
                                                />
                                                Cancelling…
                                            </>
                                        ) : (
                                            <>
                                                <Square size={12} />
                                                Cancel Job
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
