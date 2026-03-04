'use client'

import { Activity, Box, Cpu, HardDrive, Zap } from 'lucide-react'

import { useConnection } from '@/lib/connection'
import { useDashboard } from '@/hooks/use-dashboard'
import { useEventBusLifecycle, useEventBasedRefresh } from '@/hooks/use-events'

function StatCard({
    icon: Icon,
    label,
    value,
    unit,
}: {
    icon: React.ElementType
    label: string
    value: string
    unit?: string
}) {
    return (
        <div className="dashboard-card flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <Icon size={20} />
            </div>
            <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                    {label}
                </p>
                <p className="text-xl font-semibold font-mono">
                    {value}
                    {unit && (
                        <span className="text-sm text-text-muted ml-1">{unit}</span>
                    )}
                </p>
            </div>
        </div>
    )
}

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
}

export default function DashboardHome() {
    const { status, version, isConnected } = useConnection()
    const dashboard = useDashboard()

    // Start SSE event bus and auto-refresh SWR caches
    useEventBusLifecycle()
    useEventBasedRefresh()

    const statusDotClass =
        status === 'connected'
            ? 'status-dot-online'
            : status === 'connecting'
                ? 'status-dot-loading'
                : 'status-dot-offline'

    const statusLabel =
        status === 'connected'
            ? `v${version ?? '?'}`
            : status === 'connecting'
                ? 'connecting…'
                : 'disconnected'

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-[var(--opta-border)] glass-subtle">
                <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
                    {/* Left: Branding */}
                    <div className="flex items-center gap-3 justify-start">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/15 border border-primary/30">
                            <Zap size={16} className="text-primary" />
                        </div>
                        <h1
                            className="text-sm font-semibold tracking-wide"
                            style={{
                                background:
                                    'linear-gradient(135deg, var(--opta-primary) 0%, var(--opta-primary-glow) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            Opta LMX
                        </h1>
                    </div>

                    {/* Center: New Logo */}
                    <div className="flex items-center justify-center">
                        <img
                            src="/opta-code-env-logo.png"
                            alt="Opta Code Environment"
                            className="h-10 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)] mix-blend-screen"
                        />
                    </div>

                    {/* Right: Status */}
                    <div className="flex items-center gap-2 justify-end">
                        <span className={`status-dot ${statusDotClass}`} />
                        <span className="text-xs text-text-muted font-mono">
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </header>

            {/* Dashboard Grid */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={Box}
                        label="Loaded Models"
                        value={
                            isConnected
                                ? String(dashboard.loadedModelCount)
                                : '—'
                        }
                    />
                    <StatCard
                        icon={Cpu}
                        label="Tokens/sec"
                        value={
                            isConnected
                                ? dashboard.tokensPerSec > 0
                                    ? dashboard.tokensPerSec.toFixed(1)
                                    : '0'
                                : '—'
                        }
                    />
                    <StatCard
                        icon={HardDrive}
                        label="Memory"
                        value={
                            isConnected
                                ? `${dashboard.memoryUsedGb.toFixed(1)} / ${dashboard.memoryTotalGb.toFixed(1)}`
                                : '—'
                        }
                        unit={isConnected ? 'GB' : undefined}
                    />
                    <StatCard
                        icon={Activity}
                        label="Requests"
                        value={
                            isConnected
                                ? String(dashboard.totalRequests)
                                : '—'
                        }
                    />
                </div>

                {/* Content Area */}
                {!isConnected ? (
                    <div className="dashboard-card text-center py-16">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-6">
                            <Zap size={28} className="text-primary" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2">
                            Opta LMX Dashboard
                        </h2>
                        <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                            The primary management surface for your local AI inference engine.
                            Connect to your Opta LMX instance to monitor models, memory, and
                            throughput.
                        </p>
                        <p className="text-xs text-text-muted font-mono">
                            Default endpoint: 192.168.188.11:1234
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Health Status */}
                        <div className="dashboard-card">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                                    System Health
                                </h2>
                                <span
                                    className={`text-xs font-mono px-2 py-0.5 rounded ${dashboard.healthStatus === 'ok'
                                        ? 'bg-[var(--opta-neon-green)]/15 text-[var(--opta-neon-green)]'
                                        : dashboard.healthStatus === 'degraded'
                                            ? 'bg-[var(--opta-neon-amber)]/15 text-[var(--opta-neon-amber)]'
                                            : 'bg-[var(--opta-neon-red)]/15 text-[var(--opta-neon-red)]'
                                        }`}
                                >
                                    {dashboard.healthStatus}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-text-muted text-xs">Uptime</p>
                                    <p className="font-mono">
                                        {formatUptime(dashboard.uptimeSeconds)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-muted text-xs">Memory</p>
                                    <p className="font-mono">
                                        {dashboard.memoryUsedPercent.toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-muted text-xs">In-Flight</p>
                                    <p className="font-mono">
                                        {dashboard.inFlightRequests}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-muted text-xs">Version</p>
                                    <p className="font-mono">{dashboard.version ?? '—'}</p>
                                </div>
                            </div>
                            {dashboard.healthReason && (
                                <p className="text-xs text-[var(--opta-neon-amber)] mt-3 font-mono">
                                    ⚠ {dashboard.healthReason}
                                </p>
                            )}
                        </div>

                        {/* Loaded Models */}
                        {dashboard.models.length > 0 && (
                            <div className="dashboard-card">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                                    Loaded Models
                                </h2>
                                <div className="space-y-3">
                                    {dashboard.models.map((model) => (
                                        <div
                                            key={model.model_id}
                                            className="flex items-center justify-between py-2 border-b border-[var(--opta-border)] last:border-0"
                                        >
                                            <div>
                                                <p className="text-sm font-mono">
                                                    {model.model_id}
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    {model.backend} ·{' '}
                                                    {model.memory_used_gb.toFixed(1)} GB
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-mono">
                                                    {model.stats.avg_tokens_per_second.toFixed(1)}{' '}
                                                    <span className="text-xs text-text-muted">
                                                        tok/s
                                                    </span>
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    {model.stats.total_requests} reqs
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    )
}
