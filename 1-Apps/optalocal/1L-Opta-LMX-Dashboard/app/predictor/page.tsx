'use client'

import { AlertCircle, BrainCircuit, Loader2, RefreshCw } from 'lucide-react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { usePredictor } from '@/hooks/use-status'

export default function PredictorPage() {
    const { isConnected } = useConnection()
    const { predictor, isLoading, error, refresh } = usePredictor()

    return (
        <DashboardLayout>
            <PageHeader
                title="Predictor"
                subtitle="Usage-based model preloading predictions and transition telemetry"
                icon={BrainCircuit}
                action={
                    <button
                        onClick={() => refresh()}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh predictor stats"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to inspect predictor telemetry.</span>
                    </div>
                )}

                {error && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-red)]">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono">{(error as Error).message}</span>
                    </div>
                )}

                {isLoading && !predictor ? (
                    <div className="config-panel flex items-center gap-2 text-text-muted">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-sm">Loading predictor stats…</span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="config-panel">
                                <p className="config-label">Predicted Next Model</p>
                                <p className="text-sm font-mono text-primary break-all">
                                    {predictor?.predicted_next ?? '—'}
                                </p>
                            </div>
                            <div className="config-panel">
                                <p className="config-label">Total Accesses</p>
                                <p className="text-2xl font-mono">
                                    {predictor?.total_accesses ?? 0}
                                </p>
                            </div>
                            <div className="config-panel">
                                <p className="config-label">Unique Models</p>
                                <p className="text-2xl font-mono">
                                    {predictor?.unique_models ?? 0}
                                </p>
                            </div>
                            <div className="config-panel">
                                <p className="config-label">History Size</p>
                                <p className="text-2xl font-mono">
                                    {predictor?.history_size ?? 0}
                                </p>
                            </div>
                            <div className="config-panel">
                                <p className="config-label">Transitions Logged</p>
                                <p className="text-2xl font-mono">
                                    {predictor?.transition_count ?? 0}
                                </p>
                            </div>
                        </div>

                        <div className="config-panel">
                            <div className="config-title">Hot Models</div>
                            {!predictor?.top_models || predictor.top_models.length === 0 ? (
                                <p className="text-sm text-text-muted font-mono">No model usage history yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {predictor.top_models.map(([modelId, count]) => (
                                        <div
                                            key={modelId}
                                            className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0"
                                        >
                                            <p className="text-sm font-mono text-text-primary break-all">{modelId}</p>
                                            <span className="text-xs font-mono text-text-muted">{count} accesses</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="config-panel">
                            <div className="config-title">Raw Predictor Payload</div>
                            <pre className="text-xs font-mono overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
                                {JSON.stringify(predictor ?? {}, null, 2)}
                            </pre>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
