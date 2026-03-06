'use client'

import { BookOpen, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { usePresets, usePreset } from '@/hooks/use-presets'
import { useConnection } from '@/lib/connection'
import { reloadPresets } from '@/lib/mutations'

export default function PresetsPage() {
    const { isConnected } = useConnection()
    const {
        presets,
        total,
        error: listError,
        isLoading: listLoading,
        refresh: refreshList,
    } = usePresets()

    const [selectedName, setSelectedName] = useState<string | null>(null)
    const [reloading, setReloading] = useState(false)
    const [reloadError, setReloadError] = useState<string | null>(null)

    useEffect(() => {
        if (!presets.length) {
            setSelectedName(null)
            return
        }

        if (!selectedName || !presets.some((preset) => preset.name === selectedName)) {
            setSelectedName(presets[0].name)
        }
    }, [presets, selectedName])

    const selectedFromList = useMemo(
        () => presets.find((preset) => preset.name === selectedName) ?? null,
        [presets, selectedName]
    )

    const {
        preset,
        error: detailError,
        isLoading: detailLoading,
        refresh: refreshDetail,
    } = usePreset(selectedName)

    const activePreset = preset ?? selectedFromList

    async function handleReload() {
        if (!isConnected || reloading) return
        setReloading(true)
        setReloadError(null)

        try {
            await reloadPresets()
            await refreshList()
            await refreshDetail()
        } catch (error) {
            setReloadError((error as Error).message)
        } finally {
            setReloading(false)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Presets"
                subtitle="Inspect routing presets, aliases, and default generation parameters"
                icon={BookOpen}
                action={
                    <button
                        onClick={handleReload}
                        disabled={!isConnected || reloading}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
                        title="Reload presets from backend"
                    >
                        {reloading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                    </button>
                }
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to browse presets.</span>
                    </div>
                )}

                {(reloadError || listError) && (
                    <div className="config-panel flex items-center justify-between gap-4 text-[var(--opta-neon-red)]">
                        <div className="flex items-center gap-3 min-w-0">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <span className="text-sm font-mono truncate">
                                {reloadError ?? (listError as Error).message}
                            </span>
                        </div>
                        <button onClick={() => refreshList()} className="holographic-btn text-xs py-1.5 px-3">
                            Retry
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                    <section className="config-panel">
                        <div className="flex items-center justify-between mb-4">
                            <div className="config-title mb-0">Available Presets</div>
                            <span className="text-xs font-mono text-text-muted">{total}</span>
                        </div>

                        {listLoading ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                                <Loader2 size={14} className="animate-spin" />
                                Loading presets…
                            </div>
                        ) : presets.length === 0 ? (
                            <p className="text-sm text-text-muted font-mono">
                                No presets found. Use reload after adding preset files.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                                {presets.map((presetItem) => {
                                    const isActive = presetItem.name === selectedName
                                    return (
                                        <button
                                            key={presetItem.name}
                                            onClick={() => setSelectedName(presetItem.name)}
                                            className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                                                isActive
                                                    ? 'border-primary/40 bg-primary/10'
                                                    : 'border-[rgba(168,85,247,0.18)] hover:border-primary/30 hover:bg-white/5'
                                            }`}
                                        >
                                            <p className="text-sm font-mono text-text-primary truncate">{presetItem.name}</p>
                                            <p className="text-xs text-text-muted mt-1 line-clamp-2">
                                                {presetItem.description || 'No description'}
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    <section className="config-panel">
                        <div className="config-title">Preset Details</div>

                        {!selectedName ? (
                            <p className="text-sm text-text-muted font-mono">Select a preset to view its details.</p>
                        ) : detailLoading && !activePreset ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                                <Loader2 size={14} className="animate-spin" />
                                Loading preset details…
                            </div>
                        ) : detailError && !activePreset ? (
                            <div className="flex items-center gap-3 text-[var(--opta-neon-red)]">
                                <AlertCircle size={16} />
                                <span className="text-sm font-mono">{(detailError as Error).message}</span>
                            </div>
                        ) : activePreset ? (
                            <div className="space-y-6">
                                {detailError && (
                                    <div className="text-xs text-[var(--opta-neon-amber)] font-mono">
                                        Showing list data while detail endpoint failed: {(detailError as Error).message}
                                    </div>
                                )}

                                <div>
                                    <p className="config-label">Name</p>
                                    <p className="text-sm font-mono text-text-primary">{activePreset.name}</p>
                                </div>

                                <div>
                                    <p className="config-label">Description</p>
                                    <p className="text-sm text-text-secondary">
                                        {activePreset.description || 'No description provided.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <p className="config-label">Model Pattern</p>
                                        <p className="text-xs font-mono text-text-muted break-all">
                                            {activePreset.model_pattern ?? '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="config-label">Routing Aliases</p>
                                        {activePreset.routing_aliases?.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {activePreset.routing_aliases.map((alias) => (
                                                    <span
                                                        key={alias}
                                                        className="text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary border border-primary/25"
                                                    >
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs font-mono text-text-muted">None</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="config-label">Parameters</p>
                                    <pre className="config-panel text-xs font-mono overflow-auto max-h-[380px] whitespace-pre-wrap break-words">
                                        {JSON.stringify(activePreset.parameters ?? {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-text-muted font-mono">Preset data unavailable.</p>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    )
}
