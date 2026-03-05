'use client'

import { Stethoscope, Loader2, AlertCircle, Clock } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { HudRing } from '@/components/HudRing'
import { useConnection } from '@/lib/connection'
import { useDiagnostics } from '@/hooks/use-diagnostics'

export default function DiagnosticsPage() {
    const { isConnected } = useConnection()
    const { diagnostics, isLoading } = useDiagnostics()

    function formatUptime(seconds: number): string {
        if (seconds < 60) return `${Math.floor(seconds)}s`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return `${h}h ${m}m`
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Diagnostics"
                subtitle="System health, memory breakdown, and error triage"
                icon={Stethoscope}
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected || !diagnostics ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        {isLoading ? (
                            <><Loader2 size={24} className="animate-spin text-primary mb-4" /><p className="text-sm text-text-muted">Loading diagnostics…</p></>
                        ) : (
                            <><Stethoscope size={32} className="text-text-muted mb-4 opacity-30" /><p className="text-sm text-text-muted">Connect to LMX to view diagnostics.</p></>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Verdict */}
                        <div className="flex items-center gap-4 mb-8">
                            <span className={`status-dot ${diagnostics.verdict === 'healthy' ? 'status-dot-online'
                                    : diagnostics.verdict === 'degraded' ? 'status-dot-loading'
                                        : 'status-dot-offline'
                                }`} />
                            <span className={`text-lg font-mono uppercase tracking-widest ${diagnostics.verdict === 'healthy' ? 'text-[var(--opta-neon-green)]'
                                    : diagnostics.verdict === 'degraded' ? 'text-[var(--opta-neon-amber)]'
                                        : 'text-[var(--opta-neon-red)]'
                                }`}>{diagnostics.verdict}</span>
                            {diagnostics.reason && <span className="text-sm text-text-muted font-mono">— {diagnostics.reason}</span>}
                            <span className="text-sm text-text-muted font-mono ml-auto flex items-center gap-1"><Clock size={12} /> {formatUptime(diagnostics.uptime_seconds)}</span>
                        </div>

                        {/* HUD Rings */}
                        <div className="flex flex-wrap justify-center gap-12 xl:gap-20 py-8 mb-8">
                            <HudRing value={diagnostics.memory.used_percent.toFixed(0)} unit="%" label="Memory" />
                            <HudRing value={diagnostics.metrics.avg_tokens_per_second.toFixed(1)} label="Avg tok/s" reverse />
                            <HudRing value={String(diagnostics.metrics.total_requests)} label="Requests" variant="cyan" />
                            <HudRing value={`${(diagnostics.metrics.error_rate * 100).toFixed(1)}`} unit="%" label="Error Rate" variant="amber" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Memory */}
                            <div className="config-panel">
                                <div className="config-title">Memory</div>
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <p className="config-label">Usage</p>
                                        <p className="font-mono text-lg">{diagnostics.memory.used_gb.toFixed(1)} / {diagnostics.memory.total_gb.toFixed(1)} GB</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Threshold</p>
                                        <p className="font-mono">{diagnostics.memory.threshold_percent}%</p>
                                    </div>
                                    <div className="h-2 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${diagnostics.memory.used_percent > diagnostics.memory.threshold_percent
                                                    ? 'bg-[var(--opta-neon-red)]'
                                                    : diagnostics.memory.used_percent > 70
                                                        ? 'bg-[var(--opta-neon-amber)]'
                                                        : 'bg-primary'
                                                }`}
                                            style={{ width: `${Math.min(diagnostics.memory.used_percent, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Loaded Models */}
                            <div className="config-panel">
                                <div className="config-title">Loaded Models ({diagnostics.models.length})</div>
                                {diagnostics.models.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">No models loaded.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {diagnostics.models.map(m => (
                                            <div key={m.model_id} className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0">
                                                <div>
                                                    <p className="text-sm font-mono">{m.model_id}</p>
                                                    <p className="text-xs text-text-muted font-mono">{m.backend} · {m.memory_gb.toFixed(1)} GB</p>
                                                </div>
                                                <span className="text-xs font-mono text-text-muted">{m.requests} reqs</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Errors */}
                            <div className="config-panel lg:col-span-2">
                                <div className="config-title">Recent Errors</div>
                                {diagnostics.recent_errors.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">No recent errors.</p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {diagnostics.recent_errors.map((err, i) => (
                                            <div key={i} className="flex items-start gap-3 py-2 border-b border-[rgba(168,85,247,0.1)] last:border-0">
                                                <AlertCircle size={12} className="text-[var(--opta-neon-red)] mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs font-mono text-text-secondary">{err.message}</p>
                                                    <p className="text-[10px] font-mono text-text-muted mt-0.5">{err.category} · {new Date(err.timestamp * 1000).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
