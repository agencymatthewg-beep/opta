'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ConnectionSetupOverlay } from '@/components/ConnectionSetupOverlay'
import { HudRing } from '@/components/HudRing'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { getConnectErrorMessage } from '@/lib/connect-hints'
import { usePairedDevice } from '@/lib/paired-device'
import { useDashboard } from '@/hooks/use-dashboard'

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
}

export default function DashboardHome() {
    const { isConnected } = useConnection()
    const pairedDevice = usePairedDevice()
    const dashboard = useDashboard()
    const [connectErrorCode, setConnectErrorCode] = useState<string | null>(null)
    const [isFirstRun, setIsFirstRun] = useState(false)

    useEffect(() => {
        const query = new URLSearchParams(window.location.search)
        setConnectErrorCode(query.get('connect_error'))
        // Detect first-run: no saved endpoint in localStorage
        const savedUrl = localStorage.getItem('opta-lmx-url')
        setIsFirstRun(!savedUrl)
    }, [])

    const connectErrorMessage = getConnectErrorMessage(connectErrorCode)

    return (
        <DashboardLayout>
            <PageHeader
                title="Overview"
                subtitle="Live view of your AI engine"
                icon={Sparkles}
            />

            <div className="px-6 py-6 hud-fade-in">
                {!isConnected && isFirstRun ? (
                    <ConnectionSetupOverlay />
                ) : !isConnected ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative w-20 h-20 mb-8">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logos/opta-lmx-mark.svg" className="w-16 h-16 mx-auto drop-shadow-[0_0_15px_rgba(139,92,246,0.6)] relative z-10" alt="LMX" />
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2">Opta LMX Dashboard</h2>
                        <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                            The primary management surface for your local AI inference engine.
                            Connect to your Opta LMX instance to monitor models, memory, and throughput.
                        </p>
                        <p className="text-xs text-text-muted font-mono">Default endpoint: 127.0.0.1:1234</p>
                        {pairedDevice.mode === 'paired' && !pairedDevice.session && (
                            <div className="mt-5 inline-flex items-center gap-2 text-xs font-mono text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10 border border-[var(--opta-neon-amber)]/20 px-3 py-2 rounded-md">
                                <AlertCircle size={12} />
                                <span>Pairing is required before dashboard control is enabled.</span>
                            </div>
                        )}
                        {connectErrorMessage && (
                            <div className="mt-5 inline-flex items-center gap-2 text-xs font-mono text-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10 border border-[var(--opta-neon-red)]/20 px-3 py-2 rounded-md">
                                <AlertCircle size={12} />
                                <span>{connectErrorMessage}</span>
                            </div>
                        )}
                        <div className="mt-6 flex flex-wrap gap-3 justify-center">
                            {pairedDevice.mode === 'paired' && !pairedDevice.session ? (
                                <Link
                                    href="/pair"
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-primary/30 text-xs font-mono uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
                                >
                                    Start Pairing
                                </Link>
                            ) : (
                                <Link
                                    href="/settings"
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-primary/30 text-xs font-mono uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
                                >
                                    Open Connection Settings
                                </Link>
                            )}
                            <Link
                                href="/setup"
                                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-primary/30 text-xs font-mono uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
                            >
                                Setup Checks
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* HUD Data Rings */}
                        <div className="flex flex-wrap justify-center gap-12 xl:gap-20 py-10 mb-8">
                            <HudRing
                                value={dashboard.memoryUsedPercent.toFixed(0)}
                                unit="%"
                                label="Memory Used"
                            />
                            <HudRing
                                value={dashboard.tokensPerSec > 0 ? dashboard.tokensPerSec.toFixed(1) : '0'}
                                label="Speed (tok/s)"
                                reverse
                            />
                            <HudRing
                                value={String(dashboard.loadedModelCount).padStart(2, '0')}
                                label="Models Loaded"
                                variant="cyan"
                            />
                            <HudRing
                                value={String(dashboard.totalRequests)}
                                label="Requests"
                                variant="amber"
                            />
                        </div>

                        {/* Health + System */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Health Status */}
                            <div className="config-panel">
                                <div className="config-title">System Health</div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="config-label">Status</p>
                                        <p className={`font-mono text-sm ${dashboard.healthStatus === 'ok'
                                                ? 'text-[var(--opta-neon-green)]'
                                                : dashboard.healthStatus === 'degraded'
                                                    ? 'text-[var(--opta-neon-amber)]'
                                                    : 'text-[var(--opta-neon-red)]'
                                            }`}>{dashboard.healthStatus}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Uptime</p>
                                        <p className="font-mono">{formatUptime(dashboard.uptimeSeconds)}</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Memory</p>
                                        <p className="font-mono">{dashboard.memoryUsedGb.toFixed(1)} / {dashboard.memoryTotalGb.toFixed(1)} GB</p>
                                    </div>
                                    <div>
                                        <p className="config-label">Processing Now</p>
                                        <p className="font-mono">{dashboard.inFlightRequests}</p>
                                    </div>
                                </div>
                                {dashboard.healthReason && (
                                    <div className="flex items-center gap-2 mt-4 text-xs text-[var(--opta-neon-amber)] font-mono">
                                        <AlertCircle size={12} />
                                        <span>{dashboard.healthReason}</span>
                                    </div>
                                )}
                            </div>

                            {/* Loaded Models */}
                            <div className="config-panel">
                                <div className="config-title">Loaded Models</div>
                                {dashboard.models.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">No models loaded.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {dashboard.models.map((model) => (
                                            <div
                                                key={model.model_id}
                                                className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0"
                                            >
                                                <div>
                                                    <p className="text-sm font-mono">{model.model_id}</p>
                                                    <p className="text-xs text-text-muted font-mono">
                                                        {model.backend} · {model.memory_used_gb.toFixed(1)} GB
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-mono">
                                                        {model.stats.avg_tokens_per_second.toFixed(1)}{' '}
                                                        <span className="text-xs text-text-muted">tok/s</span>
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Version */}
                        <div className="text-center mt-8">
                            <span className="text-xs font-mono text-text-muted">
                                LMX {dashboard.version ? `v${dashboard.version}` : '—'}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
