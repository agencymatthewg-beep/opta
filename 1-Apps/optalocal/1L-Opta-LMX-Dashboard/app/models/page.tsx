'use client'

import { HardDrive, Download, Trash2, Play, Square, Loader2, AlertCircle, RefreshCw, FlaskConical, Gauge, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useDownloads } from '@/hooks/use-downloads'
import { useAvailableModels, useLoadedModels, useModelAutotune, useModelCompatibility, useModelPerformance } from '@/hooks/use-models'
import { useConnection } from '@/lib/connection'
import {
    autotuneModel,
    confirmAndLoad,
    deleteModel,
    downloadModel,
    loadModel,
    probeModel,
    unloadModel,
} from '@/lib/mutations'
import type {
    AdminAutotuneResponse,
    AdminProbeResponse,
    AutoDownloadResponse,
} from '@/lib/types'

function parseAutotuneProfiles(
    rawProfiles: string
): Record<string, unknown>[] | undefined {
    const trimmed = rawProfiles.trim()
    if (!trimmed) return undefined

    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
        if (!parsed.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))) {
            throw new Error('Profiles JSON array must contain objects only.')
        }
        return parsed as Record<string, unknown>[]
    }

    if (parsed && typeof parsed === 'object') {
        return [parsed as Record<string, unknown>]
    }

    throw new Error('Profiles must be a JSON object or array of objects.')
}

export default function ModelsPage() {
    const { isConnected } = useConnection()
    const { models: loaded, isLoading: loadedLoading, refresh: refreshLoaded } = useLoadedModels()
    const { available, isLoading: availableLoading, refresh: refreshAvailable } = useAvailableModels()
    const { downloads, refresh: refreshDownloads } = useDownloads()

    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [unloadingId, setUnloadingId] = useState<string | null>(null)
    const [downloadRepoId, setDownloadRepoId] = useState('')
    const [loadModelId, setLoadModelId] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [pendingConfirm, setPendingConfirm] = useState<AutoDownloadResponse | null>(null)

    // Advanced model selectors
    const [advancedModelId, setAdvancedModelId] = useState('')

    // Probe controls
    const [probeModelId, setProbeModelId] = useState('')
    const [probeTimeoutSec, setProbeTimeoutSec] = useState(90)
    const [probeAllowUnsupported, setProbeAllowUnsupported] = useState(false)
    const [probeRunning, setProbeRunning] = useState(false)
    const [probeResult, setProbeResult] = useState<AdminProbeResponse | null>(null)

    // Compatibility controls
    const [compatBackend, setCompatBackend] = useState('')

    // Autotune controls
    const [autotuneModelId, setAutotuneModelId] = useState('')
    const [autotunePrompt, setAutotunePrompt] = useState('Explain speculative decoding and when to disable it.')
    const [autotuneMaxTokens, setAutotuneMaxTokens] = useState(128)
    const [autotuneTemperature, setAutotuneTemperature] = useState(0.7)
    const [autotuneRuns, setAutotuneRuns] = useState(1)
    const [autotuneProfilesJson, setAutotuneProfilesJson] = useState('')
    const [autotuneAllowUnsupported, setAutotuneAllowUnsupported] = useState(false)
    const [autotuneRunning, setAutotuneRunning] = useState(false)
    const [autotuneResult, setAutotuneResult] = useState<AdminAutotuneResponse | null>(null)

    const {
        performance,
        isLoading: performanceLoading,
        error: performanceError,
        refresh: refreshPerformance,
    } = useModelPerformance(advancedModelId || null)
    const {
        autotune: autotuneRecord,
        isLoading: autotuneRecordLoading,
        error: autotuneRecordError,
        refresh: refreshAutotuneRecord,
    } = useModelAutotune(advancedModelId || null)
    const {
        compatibility,
        isLoading: compatibilityLoading,
        error: compatibilityError,
        refresh: refreshCompatibility,
    } = useModelCompatibility({
        modelId: advancedModelId || undefined,
        backend: compatBackend.trim() || undefined,
    })

    const loadedIds = useMemo(
        () => loaded?.map((entry) => entry.model_id) ?? [],
        [loaded]
    )

    useEffect(() => {
        if (!loadedIds.length) return
        if (!advancedModelId) setAdvancedModelId(loadedIds[0])
        if (!probeModelId) setProbeModelId(loadedIds[0])
        if (!autotuneModelId) setAutotuneModelId(loadedIds[0])
    }, [advancedModelId, autotuneModelId, loadedIds, probeModelId])

    async function handleLoad(modelId: string) {
        setLoadingId(modelId)
        setError(null)
        try {
            const result = await loadModel({ model_id: modelId, auto_download: true })
            if ('download_id' in result || 'confirmation_token' in result) {
                setPendingConfirm(result as AutoDownloadResponse)
            }
            refreshLoaded()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setLoadingId(null)
        }
    }

    async function handleUnload(modelId: string) {
        setUnloadingId(modelId)
        setError(null)
        try {
            await unloadModel(modelId)
            refreshLoaded()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setUnloadingId(null)
        }
    }

    async function handleDelete(modelId: string) {
        if (!confirm(`Delete ${modelId} from disk?`)) return
        setError(null)
        try {
            await deleteModel(modelId)
            refreshAvailable()
        } catch (e) {
            setError((e as Error).message)
        }
    }

    async function handleDownload() {
        if (!downloadRepoId.trim()) return
        setError(null)
        try {
            await downloadModel({ repo_id: downloadRepoId.trim() })
            setDownloadRepoId('')
            refreshDownloads()
        } catch (e) {
            setError((e as Error).message)
        }
    }

    async function handleConfirm() {
        if (!pendingConfirm?.confirmation_token) return
        try {
            await confirmAndLoad({ confirmation_token: pendingConfirm.confirmation_token })
            setPendingConfirm(null)
            refreshDownloads()
        } catch (e) {
            setError((e as Error).message)
        }
    }

    async function handleQuickLoad() {
        if (!loadModelId.trim()) return
        await handleLoad(loadModelId.trim())
        setLoadModelId('')
    }

    async function handleProbe() {
        const targetModelId = probeModelId.trim()
        if (!targetModelId) return

        setProbeRunning(true)
        setError(null)
        setProbeResult(null)

        try {
            const response = await probeModel({
                model_id: targetModelId,
                timeout_sec: probeTimeoutSec,
                allow_unsupported_runtime: probeAllowUnsupported,
            })
            setProbeResult(response)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setProbeRunning(false)
        }
    }

    async function handleAutotune() {
        const targetModelId = autotuneModelId.trim()
        if (!targetModelId) return

        setAutotuneRunning(true)
        setError(null)
        setAutotuneResult(null)

        try {
            const profiles = parseAutotuneProfiles(autotuneProfilesJson)
            const response = await autotuneModel({
                model_id: targetModelId,
                prompt: autotunePrompt,
                max_tokens: autotuneMaxTokens,
                temperature: autotuneTemperature,
                runs: autotuneRuns,
                allow_unsupported_runtime: autotuneAllowUnsupported,
                profiles,
            })
            setAutotuneResult(response)
            setAdvancedModelId(targetModelId)
            refreshAutotuneRecord()
            refreshPerformance()
            refreshCompatibility()
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setAutotuneRunning(false)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Models"
                subtitle="Load, unload, download, and manage inference models"
                icon={HardDrive}
                action={
                    <button
                        onClick={() => {
                            refreshLoaded()
                            refreshAvailable()
                            refreshDownloads()
                        }}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to manage models.</span>
                    </div>
                )}

                {error && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-red)]">
                        <AlertCircle size={16} /> <span className="text-sm font-mono">{error}</span>
                    </div>
                )}

                {pendingConfirm && (
                    <div className="config-panel">
                        <div className="config-title">Download Required</div>
                        <p className="text-sm text-text-secondary mb-2">{pendingConfirm.message}</p>
                        {pendingConfirm.estimated_size_human && (
                            <p className="text-xs font-mono text-text-muted mb-4">Size: {pendingConfirm.estimated_size_human}</p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={handleConfirm} className="holographic-btn">Confirm & Download</button>
                            <button
                                onClick={() => setPendingConfirm(null)}
                                className="holographic-btn"
                                style={{ borderColor: 'var(--opta-text-muted)', color: 'var(--opta-text-muted)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="config-panel">
                    <div className="config-title">Quick Load</div>
                    <div className="flex gap-3">
                        <input
                            className="holographic-input flex-1"
                            placeholder="Model ID (e.g. mlx-community/Qwen2.5-7B-4bit)"
                            value={loadModelId}
                            onChange={e => setLoadModelId(e.target.value)}
                            disabled={!isConnected}
                        />
                        <button
                            onClick={handleQuickLoad}
                            disabled={!isConnected || !loadModelId.trim()}
                            className="holographic-btn flex items-center gap-2"
                        >
                            <Play size={12} /> Load
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="config-panel">
                        <div className="config-title">Loaded Models</div>
                        {loadedLoading ? (
                            <div className="flex items-center gap-2 text-text-muted text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                        ) : !loaded?.length ? (
                            <p className="text-sm text-text-muted font-mono">No models loaded.</p>
                        ) : (
                            <div className="space-y-3">
                                {loaded.map(m => (
                                    <div key={m.model_id} className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0">
                                        <div>
                                            <p className="text-sm font-mono">{m.model_id}</p>
                                            <p className="text-xs text-text-muted font-mono">{m.backend} · {m.memory_used_gb.toFixed(1)} GB · {m.stats.avg_tokens_per_second.toFixed(1)} tok/s</p>
                                        </div>
                                        <button onClick={() => handleUnload(m.model_id)} disabled={unloadingId === m.model_id} className="p-1.5 text-text-muted hover:text-[var(--opta-neon-red)] transition-colors">
                                            {unloadingId === m.model_id ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="config-panel">
                        <div className="config-title">On Disk</div>
                        {availableLoading ? (
                            <div className="flex items-center gap-2 text-text-muted text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                        ) : !available?.length ? (
                            <p className="text-sm text-text-muted font-mono">No models on disk.</p>
                        ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {available.map(m => {
                                    const isLoaded = loaded?.some(l => l.model_id === m.repo_id)
                                    return (
                                        <div key={m.repo_id} className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0">
                                            <div>
                                                <p className="text-sm font-mono">{m.repo_id}</p>
                                                <p className="text-xs text-text-muted font-mono">{(m.size_bytes / 1e9).toFixed(1)} GB</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!isLoaded && (
                                                    <button onClick={() => handleLoad(m.repo_id)} disabled={loadingId === m.repo_id} className="p-1.5 text-text-muted hover:text-primary transition-colors">
                                                        {loadingId === m.repo_id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(m.repo_id)} className="p-1.5 text-text-muted hover:text-[var(--opta-neon-red)] transition-colors">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="config-panel">
                    <div className="config-title">Download from HuggingFace</div>
                    <div className="flex gap-3 mb-4">
                        <input className="holographic-input flex-1" placeholder="HuggingFace repo ID" value={downloadRepoId} onChange={e => setDownloadRepoId(e.target.value)} disabled={!isConnected} />
                        <button onClick={handleDownload} disabled={!isConnected || !downloadRepoId.trim()} className="holographic-btn flex items-center gap-2">
                            <Download size={12} /> Download
                        </button>
                    </div>
                    {downloads && downloads.length > 0 && (
                        <div className="space-y-2">
                            {downloads.map(d => (
                                <div key={d.download_id} className="flex items-center justify-between text-sm">
                                    <span className="font-mono text-xs truncate mr-3">{d.repo_id}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-1 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${d.progress_percent}%` }} />
                                        </div>
                                        <span className="text-xs font-mono text-text-muted w-10 text-right">{d.progress_percent.toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="config-panel space-y-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="config-title">Advanced Models Surface</div>
                        <div className="flex items-center gap-2">
                            <select
                                className="holographic-input min-w-[220px]"
                                value={advancedModelId}
                                onChange={(event) => setAdvancedModelId(event.target.value)}
                            >
                                <option value="">Select loaded model…</option>
                                {loadedIds.map((modelId) => (
                                    <option key={`advanced-${modelId}`} value={modelId}>
                                        {modelId}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    refreshPerformance()
                                    refreshAutotuneRecord()
                                    refreshCompatibility()
                                }}
                                className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                                title="Refresh advanced model telemetry"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="space-y-5">
                            <section className="rounded-lg border border-[rgba(168,85,247,0.15)] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FlaskConical size={14} className="text-primary" />
                                    <p className="text-sm font-mono text-text-primary">Backend Probe</p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="config-label">Model ID</p>
                                        <input
                                            className="holographic-input"
                                            value={probeModelId}
                                            onChange={(event) => setProbeModelId(event.target.value)}
                                            placeholder="e.g. mlx-community/Qwen2.5-7B-4bit"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <p className="config-label">Timeout (sec)</p>
                                            <input
                                                type="number"
                                                min={1}
                                                max={900}
                                                className="holographic-input"
                                                value={probeTimeoutSec}
                                                onChange={(event) => setProbeTimeoutSec(Number(event.target.value))}
                                            />
                                        </div>
                                        <label className="flex items-end gap-2 text-xs font-mono text-text-muted pb-2">
                                            <input
                                                type="checkbox"
                                                checked={probeAllowUnsupported}
                                                onChange={(event) => setProbeAllowUnsupported(event.target.checked)}
                                            />
                                            allow unsupported runtime
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleProbe}
                                        disabled={!isConnected || probeRunning || !probeModelId.trim()}
                                        className="holographic-btn flex items-center gap-2"
                                    >
                                        {probeRunning ? <><Loader2 size={12} className="animate-spin" /> Probing…</> : <><Play size={12} /> Probe</>}
                                    </button>
                                </div>
                                {probeResult && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-mono text-primary">
                                            Recommended backend: {probeResult.recommended_backend ?? 'none'}
                                        </p>
                                        <div className="space-y-1">
                                            {probeResult.candidates.map((candidate) => (
                                                <div
                                                    key={`${candidate.backend}-${candidate.outcome}`}
                                                    className="flex items-center justify-between text-xs font-mono py-1 border-b border-[rgba(168,85,247,0.1)] last:border-0"
                                                >
                                                    <span className="text-text-primary">{candidate.backend}</span>
                                                    <span className="text-text-muted">{candidate.outcome}</span>
                                                    <span className="text-text-muted ml-3 truncate max-w-[180px] text-right">
                                                        {candidate.reason ?? '—'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-lg border border-[rgba(168,85,247,0.15)] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Wrench size={14} className="text-primary" />
                                    <p className="text-sm font-mono text-text-primary">Autotune Runner</p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="config-label">Model ID</p>
                                        <input
                                            className="holographic-input"
                                            value={autotuneModelId}
                                            onChange={(event) => setAutotuneModelId(event.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <p className="config-label">Benchmark Prompt</p>
                                        <textarea
                                            className="holographic-input resize-none"
                                            rows={3}
                                            value={autotunePrompt}
                                            onChange={(event) => setAutotunePrompt(event.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <p className="config-label">Max Tokens</p>
                                            <input
                                                type="number"
                                                min={1}
                                                max={4096}
                                                className="holographic-input"
                                                value={autotuneMaxTokens}
                                                onChange={(event) => setAutotuneMaxTokens(Number(event.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <p className="config-label">Temperature</p>
                                            <input
                                                type="number"
                                                min={0}
                                                max={2}
                                                step={0.1}
                                                className="holographic-input"
                                                value={autotuneTemperature}
                                                onChange={(event) => setAutotuneTemperature(Number(event.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <p className="config-label">Runs</p>
                                            <input
                                                type="number"
                                                min={1}
                                                max={5}
                                                className="holographic-input"
                                                value={autotuneRuns}
                                                onChange={(event) => setAutotuneRuns(Number(event.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="config-label">Profiles JSON (optional)</p>
                                        <textarea
                                            className="holographic-input resize-none font-mono text-xs"
                                            rows={4}
                                            placeholder='[{"use_batching": true}, {"use_batching": false}]'
                                            value={autotuneProfilesJson}
                                            onChange={(event) => setAutotuneProfilesJson(event.target.value)}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-mono text-text-muted">
                                        <input
                                            type="checkbox"
                                            checked={autotuneAllowUnsupported}
                                            onChange={(event) => setAutotuneAllowUnsupported(event.target.checked)}
                                        />
                                        allow unsupported runtime
                                    </label>
                                    <button
                                        onClick={handleAutotune}
                                        disabled={!isConnected || autotuneRunning || !autotuneModelId.trim()}
                                        className="holographic-btn flex items-center gap-2"
                                    >
                                        {autotuneRunning ? <><Loader2 size={12} className="animate-spin" /> Autotuning…</> : <><Play size={12} /> Run Autotune</>}
                                    </button>
                                </div>
                                {autotuneResult && (
                                    <div className="mt-4">
                                        <p className="text-xs font-mono text-primary mb-2">
                                            Best backend: {autotuneResult.backend} ({autotuneResult.backend_version})
                                        </p>
                                        <pre className="text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap break-words">
                                            {JSON.stringify(
                                                {
                                                    best_score: autotuneResult.best_score,
                                                    best_profile: autotuneResult.best_profile,
                                                    best_metrics: autotuneResult.best_metrics,
                                                    candidates: autotuneResult.candidates,
                                                },
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="space-y-5">
                            <section className="rounded-lg border border-[rgba(168,85,247,0.15)] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Gauge size={14} className="text-primary" />
                                    <p className="text-sm font-mono text-text-primary">Active Performance</p>
                                </div>
                                {performanceLoading ? (
                                    <div className="flex items-center gap-2 text-text-muted text-sm">
                                        <Loader2 size={14} className="animate-spin" /> Loading performance…
                                    </div>
                                ) : performanceError ? (
                                    <p className="text-xs font-mono text-[var(--opta-neon-red)]">
                                        {(performanceError as Error).message}
                                    </p>
                                ) : !performance ? (
                                    <p className="text-sm text-text-muted font-mono">Select a loaded model to inspect performance.</p>
                                ) : (
                                    <pre className="text-xs font-mono overflow-auto max-h-72 whitespace-pre-wrap break-words">
                                        {JSON.stringify(performance, null, 2)}
                                    </pre>
                                )}
                            </section>

                            <section className="rounded-lg border border-[rgba(168,85,247,0.15)] p-4">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <p className="text-sm font-mono text-text-primary">Stored Autotune Profile</p>
                                    <button
                                        onClick={() => refreshAutotuneRecord()}
                                        className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                                        title="Refresh autotune profile"
                                    >
                                        <RefreshCw size={12} />
                                    </button>
                                </div>
                                {autotuneRecordLoading ? (
                                    <div className="flex items-center gap-2 text-text-muted text-sm">
                                        <Loader2 size={14} className="animate-spin" /> Loading autotune profile…
                                    </div>
                                ) : autotuneRecordError ? (
                                    <p className="text-xs font-mono text-[var(--opta-neon-red)]">
                                        {(autotuneRecordError as Error).message}
                                    </p>
                                ) : !autotuneRecord ? (
                                    <p className="text-sm text-text-muted font-mono">No stored autotune profile for selected model.</p>
                                ) : (
                                    <pre className="text-xs font-mono overflow-auto max-h-72 whitespace-pre-wrap break-words">
                                        {JSON.stringify(autotuneRecord, null, 2)}
                                    </pre>
                                )}
                            </section>
                        </div>
                    </div>

                    <section className="rounded-lg border border-[rgba(168,85,247,0.15)] p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                            <p className="text-sm font-mono text-text-primary">Compatibility Registry</p>
                            <div className="flex items-center gap-2">
                                <input
                                    className="holographic-input"
                                    placeholder="Backend filter (optional)"
                                    value={compatBackend}
                                    onChange={(event) => setCompatBackend(event.target.value)}
                                />
                                <button
                                    onClick={() => refreshCompatibility()}
                                    className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                                    title="Refresh compatibility records"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        {compatibilityLoading ? (
                            <div className="flex items-center gap-2 text-text-muted text-sm">
                                <Loader2 size={14} className="animate-spin" /> Loading compatibility rows…
                            </div>
                        ) : compatibilityError ? (
                            <p className="text-xs font-mono text-[var(--opta-neon-red)]">
                                {(compatibilityError as Error).message}
                            </p>
                        ) : !compatibility?.rows?.length ? (
                            <p className="text-sm text-text-muted font-mono">No compatibility records found for current filters.</p>
                        ) : (
                            <div className="space-y-1 max-h-72 overflow-auto">
                                {compatibility.rows.slice(0, 120).map((row, index) => (
                                    <div
                                        key={`${row.model_id}-${row.backend}-${row.ts ?? index}`}
                                        className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr_0.8fr_2fr] gap-2 text-xs font-mono py-2 border-b border-[rgba(168,85,247,0.1)] last:border-0"
                                    >
                                        <span className="text-text-primary break-all">{row.model_id}</span>
                                        <span className="text-text-muted">{row.backend}</span>
                                        <span className="text-text-muted">{row.outcome}</span>
                                        <span className="text-text-muted break-words">{row.reason ?? '—'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    )
}
