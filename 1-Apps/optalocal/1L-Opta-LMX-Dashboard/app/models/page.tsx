'use client'

import { HardDrive, Download, Trash2, Play, Square, Loader2, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useLoadedModels, useAvailableModels } from '@/hooks/use-models'
import { useDownloads } from '@/hooks/use-downloads'
import { loadModel, unloadModel, deleteModel, downloadModel, confirmAndLoad } from '@/lib/mutations'
import type { AutoDownloadResponse } from '@/lib/types'

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

    async function handleLoad(modelId: string) {
        setLoadingId(modelId)
        setError(null)
        try {
            const result = await loadModel({ model_id: modelId, auto_download: true })
            if ('download_id' in result || 'confirmation_token' in result) {
                setPendingConfirm(result as AutoDownloadResponse)
            }
            refreshLoaded()
        } catch (e) { setError((e as Error).message) }
        finally { setLoadingId(null) }
    }

    async function handleUnload(modelId: string) {
        setUnloadingId(modelId)
        setError(null)
        try {
            await unloadModel(modelId)
            refreshLoaded()
        } catch (e) { setError((e as Error).message) }
        finally { setUnloadingId(null) }
    }

    async function handleDelete(modelId: string) {
        if (!confirm(`Delete ${modelId} from disk?`)) return
        setError(null)
        try {
            await deleteModel(modelId)
            refreshAvailable()
        } catch (e) { setError((e as Error).message) }
    }

    async function handleDownload() {
        if (!downloadRepoId.trim()) return
        setError(null)
        try {
            await downloadModel({ repo_id: downloadRepoId.trim() })
            setDownloadRepoId('')
            refreshDownloads()
        } catch (e) { setError((e as Error).message) }
    }

    async function handleConfirm() {
        if (!pendingConfirm?.confirmation_token) return
        try {
            await confirmAndLoad({ confirmation_token: pendingConfirm.confirmation_token })
            setPendingConfirm(null)
            refreshDownloads()
        } catch (e) { setError((e as Error).message) }
    }

    async function handleQuickLoad() {
        if (!loadModelId.trim()) return
        handleLoad(loadModelId.trim())
        setLoadModelId('')
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Models"
                subtitle="Load, unload, download, and manage inference models"
                icon={HardDrive}
                action={
                    <button onClick={() => { refreshLoaded(); refreshAvailable(); refreshDownloads() }}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors">
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

                {/* Pending download confirmation */}
                {pendingConfirm && (
                    <div className="config-panel">
                        <div className="config-title">Download Required</div>
                        <p className="text-sm text-text-secondary mb-2">{pendingConfirm.message}</p>
                        {pendingConfirm.estimated_size_human && (
                            <p className="text-xs font-mono text-text-muted mb-4">Size: {pendingConfirm.estimated_size_human}</p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={handleConfirm} className="holographic-btn">Confirm & Download</button>
                            <button onClick={() => setPendingConfirm(null)} className="holographic-btn" style={{ borderColor: 'var(--opta-text-muted)', color: 'var(--opta-text-muted)' }}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Quick Load */}
                <div className="config-panel">
                    <div className="config-title">Quick Load</div>
                    <div className="flex gap-3">
                        <input className="holographic-input flex-1" placeholder="Model ID (e.g. mlx-community/Qwen2.5-7B-4bit)" value={loadModelId} onChange={e => setLoadModelId(e.target.value)} disabled={!isConnected} />
                        <button onClick={handleQuickLoad} disabled={!isConnected || !loadModelId.trim()} className="holographic-btn flex items-center gap-2">
                            <Play size={12} /> Load
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Loaded Models */}
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

                    {/* Available Models */}
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

                {/* Download */}
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
            </div>
        </DashboardLayout>
    )
}
