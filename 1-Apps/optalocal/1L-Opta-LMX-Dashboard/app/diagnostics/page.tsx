'use client'

import { AlertCircle, Clock, Loader2, Stethoscope } from 'lucide-react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { HudRing } from '@/components/HudRing'
import { PageHeader } from '@/components/PageHeader'
import { useDiagnostics } from '@/hooks/use-diagnostics'
import {
    useDiscoveryV1,
    useHelpersHealth,
    useWellKnownDiscovery,
} from '@/hooks/use-health'
import { useConnection } from '@/lib/connection'

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
}

function formatPercent(value?: number): string {
    if (value == null || Number.isNaN(value)) return '—'
    if (value <= 1) return `${(value * 100).toFixed(1)}%`
    return `${value.toFixed(1)}%`
}

export default function DiagnosticsPage() {
    const { isConnected } = useConnection()
    const { diagnostics, isLoading } = useDiagnostics()
    const { discovery: discoveryV1, isLoading: discoveryV1Loading } =
        useDiscoveryV1()
    const {
        discovery: wellKnownDiscovery,
        isLoading: wellKnownDiscoveryLoading,
    } = useWellKnownDiscovery()
    const { helpers, isLoading: helpersLoading } = useHelpersHealth()

    const helperEntries = Object.entries(helpers?.helpers ?? {})
    const discoveryDoc = wellKnownDiscovery ?? discoveryV1
    const discoveryLoading =
        !discoveryDoc && (discoveryV1Loading || wellKnownDiscoveryLoading)

    return (
        <DashboardLayout>
            <PageHeader
                title="Diagnostics"
                subtitle="System health, helper visibility, and discovery contract state"
                icon={Stethoscope}
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected || !diagnostics ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        {isLoading ? (
                            <>
                                <Loader2
                                    size={24}
                                    className="animate-spin text-primary mb-4"
                                />
                                <p className="text-sm text-text-muted">
                                    Loading diagnostics…
                                </p>
                            </>
                        ) : (
                            <>
                                <Stethoscope
                                    size={32}
                                    className="text-text-muted mb-4 opacity-30"
                                />
                                <p className="text-sm text-text-muted">
                                    Connect to LMX to view diagnostics.
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 mb-8">
                            <span
                                className={`status-dot ${diagnostics.verdict === 'healthy'
                                        ? 'status-dot-online'
                                        : diagnostics.verdict === 'degraded'
                                            ? 'status-dot-loading'
                                            : 'status-dot-offline'
                                    }`}
                            />
                            <span
                                className={`text-lg font-mono uppercase tracking-widest ${diagnostics.verdict === 'healthy'
                                        ? 'text-[var(--opta-neon-green)]'
                                        : diagnostics.verdict === 'degraded'
                                            ? 'text-[var(--opta-neon-amber)]'
                                            : 'text-[var(--opta-neon-red)]'
                                    }`}
                            >
                                {diagnostics.verdict}
                            </span>
                            {diagnostics.reason && (
                                <span className="text-sm text-text-muted font-mono">
                                    — {diagnostics.reason}
                                </span>
                            )}
                            <span className="text-sm text-text-muted font-mono ml-auto flex items-center gap-1">
                                <Clock size={12} />{' '}
                                {formatUptime(diagnostics.uptime_seconds)}
                            </span>
                        </div>

                        <div className="flex flex-wrap justify-center gap-12 xl:gap-20 py-8 mb-8">
                            <HudRing
                                value={diagnostics.memory.used_percent.toFixed(0)}
                                unit="%"
                                label="Memory"
                            />
                            <HudRing
                                value={diagnostics.metrics.avg_tokens_per_second.toFixed(
                                    1
                                )}
                                label="Avg tok/s"
                                reverse
                            />
                            <HudRing
                                value={String(diagnostics.metrics.total_requests)}
                                label="Requests"
                                variant="cyan"
                            />
                            <HudRing
                                value={`${(
                                    diagnostics.metrics.error_rate * 100
                                ).toFixed(1)}`}
                                unit="%"
                                label="Error Rate"
                                variant="amber"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="config-panel">
                                <div className="config-title">Memory</div>
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <p className="config-label">Usage</p>
                                        <p className="font-mono text-lg">
                                            {diagnostics.memory.used_gb.toFixed(
                                                1
                                            )}{' '}
                                            /{' '}
                                            {diagnostics.memory.total_gb.toFixed(
                                                1
                                            )}{' '}
                                            GB
                                        </p>
                                    </div>
                                    <div>
                                        <p className="config-label">Threshold</p>
                                        <p className="font-mono">
                                            {diagnostics.memory.threshold_percent}
                                            %
                                        </p>
                                    </div>
                                    <div className="h-2 bg-[var(--opta-elevated)] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${diagnostics.memory.used_percent >
                                                    diagnostics.memory.threshold_percent
                                                    ? 'bg-[var(--opta-neon-red)]'
                                                    : diagnostics.memory.used_percent >
                                                        70
                                                        ? 'bg-[var(--opta-neon-amber)]'
                                                        : 'bg-primary'
                                                }`}
                                            style={{
                                                width: `${Math.min(
                                                    diagnostics.memory
                                                        .used_percent,
                                                    100
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="config-panel">
                                <div className="config-title">
                                    Loaded Models ({diagnostics.models.length})
                                </div>
                                {diagnostics.models.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">
                                        No models loaded.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {diagnostics.models.map((model) => (
                                            <div
                                                key={model.model_id}
                                                className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0"
                                            >
                                                <div>
                                                    <p className="text-sm font-mono">
                                                        {model.model_id}
                                                    </p>
                                                    <p className="text-xs text-text-muted font-mono">
                                                        {model.backend} ·{' '}
                                                        {model.memory_gb.toFixed(
                                                            1
                                                        )}{' '}
                                                        GB
                                                    </p>
                                                </div>
                                                <span className="text-xs font-mono text-text-muted">
                                                    {model.requests} reqs
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="config-panel">
                                <div className="config-title flex items-center justify-between">
                                    <span>
                                        Helper Nodes ({helpers?.configured_count ?? helperEntries.length})
                                    </span>
                                    {helpers?.all_healthy != null && (
                                        <span
                                            className={`text-[10px] uppercase tracking-widest font-mono ${helpers.all_healthy
                                                    ? 'text-[var(--opta-neon-green)]'
                                                    : 'text-[var(--opta-neon-red)]'
                                                }`}
                                        >
                                            {helpers.all_healthy
                                                ? 'all healthy'
                                                : 'degraded'}
                                        </span>
                                    )}
                                </div>
                                {helpersLoading && helperEntries.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <Loader2
                                            size={13}
                                            className="animate-spin"
                                        />
                                        Loading helper health…
                                    </div>
                                ) : helperEntries.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">
                                        No helper nodes configured.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {helperEntries.map(([name, stats]) => {
                                            const liveStatus =
                                                helpers?.live_checks?.[name]
                                            const healthy =
                                                typeof liveStatus === 'boolean'
                                                    ? liveStatus
                                                    : Boolean(stats.healthy)
                                            return (
                                                <div
                                                    key={name}
                                                    className="py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0"
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-sm font-mono">
                                                            {name}
                                                        </p>
                                                        <span
                                                            className={`text-[10px] font-mono uppercase tracking-wider ${healthy
                                                                    ? 'text-[var(--opta-neon-green)]'
                                                                    : 'text-[var(--opta-neon-red)]'
                                                                }`}
                                                        >
                                                            {healthy
                                                                ? 'healthy'
                                                                : 'unhealthy'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] font-mono text-text-muted break-all">
                                                        {String(
                                                            stats.url ?? '—'
                                                        )}
                                                    </p>
                                                    <div className="mt-1 text-[10px] font-mono text-text-muted flex flex-wrap gap-3">
                                                        <span>
                                                            latency:{' '}
                                                            {stats.latency_ms !=
                                                                null
                                                                ? `${Number(stats.latency_ms).toFixed(1)}ms`
                                                                : '—'}
                                                        </span>
                                                        <span>
                                                            success:{' '}
                                                            {formatPercent(
                                                                Number(
                                                                    stats.success_rate
                                                                )
                                                            )}
                                                        </span>
                                                        <span>
                                                            req:{' '}
                                                            {stats.request_count ??
                                                                '—'}
                                                        </span>
                                                        {stats.circuit_state !=
                                                            null && (
                                                                <span>
                                                                    circuit:{' '}
                                                                    {String(
                                                                        stats.circuit_state
                                                                    )}
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="config-panel lg:col-span-2">
                                <div className="config-title flex items-center justify-between">
                                    <span>Discovery Contract</span>
                                    <span className="text-[10px] font-mono text-text-muted">
                                        {wellKnownDiscovery
                                            ? '.well-known'
                                            : discoveryV1
                                                ? '/v1/discovery'
                                                : 'unavailable'}
                                    </span>
                                </div>
                                {discoveryLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <Loader2
                                            size={13}
                                            className="animate-spin"
                                        />
                                        Loading discovery document…
                                    </div>
                                ) : !discoveryDoc ? (
                                    <p className="text-sm text-text-muted font-mono">
                                        Discovery endpoint unavailable.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                                            <div>
                                                <p className="config-label">
                                                    Service
                                                </p>
                                                <p>
                                                    {String(
                                                        discoveryDoc.service ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="config-label">
                                                    Version
                                                </p>
                                                <p>
                                                    {String(
                                                        discoveryDoc.version ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="config-label">
                                                    Schema
                                                </p>
                                                <p>
                                                    {String(
                                                        discoveryDoc.schema_version ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="config-label">
                                                    Ready
                                                </p>
                                                <p>
                                                    {String(
                                                        discoveryDoc.ready ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="config-label">
                                                    Loaded Models
                                                </p>
                                                <p>
                                                    {discoveryDoc.loaded_model_count ??
                                                        discoveryDoc.loaded_models
                                                            ?.length ??
                                                        '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="config-label">
                                                    Admin Key Required
                                                </p>
                                                <p>
                                                    {String(
                                                        discoveryDoc.auth
                                                            ?.admin_key_required ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="config-label mb-1">
                                                Endpoints
                                            </p>
                                            <div className="text-xs font-mono text-text-muted space-y-1">
                                                <p>
                                                    preferred:{' '}
                                                    {String(
                                                        discoveryDoc.endpoints
                                                            ?.preferred_base_url ??
                                                        '—'
                                                    )}
                                                </p>
                                                <p>
                                                    openai:{' '}
                                                    {String(
                                                        discoveryDoc.endpoints
                                                            ?.openai_base_url ??
                                                        '—'
                                                    )}
                                                </p>
                                                <p>
                                                    admin:{' '}
                                                    {String(
                                                        discoveryDoc.endpoints
                                                            ?.admin_base_url ??
                                                        '—'
                                                    )}
                                                </p>
                                                <p>
                                                    websocket:{' '}
                                                    {String(
                                                        discoveryDoc.endpoints
                                                            ?.websocket_url ??
                                                        '—'
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {Array.isArray(
                                            discoveryDoc.client_probe_order
                                        ) &&
                                            discoveryDoc.client_probe_order.length >
                                            0 && (
                                                <div>
                                                    <p className="config-label mb-1">
                                                        Client Probe Order
                                                    </p>
                                                    <p className="text-xs font-mono text-text-muted">
                                                        {discoveryDoc.client_probe_order.join(
                                                            ' → '
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>

                            <div className="config-panel lg:col-span-2">
                                <div className="config-title">Recent Errors</div>
                                {diagnostics.recent_errors.length === 0 ? (
                                    <p className="text-sm text-text-muted font-mono">
                                        No recent errors.
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {diagnostics.recent_errors.map(
                                            (err, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-start gap-3 py-2 border-b border-[rgba(168,85,247,0.1)] last:border-0"
                                                >
                                                    <AlertCircle
                                                        size={12}
                                                        className="text-[var(--opta-neon-red)] mt-0.5 flex-shrink-0"
                                                    />
                                                    <div>
                                                        <p className="text-xs font-mono text-text-secondary">
                                                            {err.message}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-text-muted mt-0.5">
                                                            {err.category} ·{' '}
                                                            {new Date(
                                                                err.timestamp *
                                                                1000
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        )}
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

