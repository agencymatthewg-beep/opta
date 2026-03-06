'use client'

import { motion } from 'framer-motion'
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Globe,
    Radio,
    RefreshCw,
    Unplug,
    WifiOff,
} from 'lucide-react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useBridge } from '@/hooks/use-bridge'
import { cn } from '@/lib/utils'

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatusPillProps {
    connected: boolean
    status: string
}

function StatusPill({ connected, status }: StatusPillProps) {
    const colorClass = connected
        ? 'text-[var(--opta-neon-green)]'
        : status === 'pairing'
            ? 'text-[var(--opta-neon-amber)]'
            : 'text-[var(--opta-neon-red)]'

    const dotClass = connected
        ? 'status-dot-online'
        : status === 'pairing'
            ? 'status-dot-loading'
            : 'status-dot-offline'

    return (
        <span className={cn('flex items-center gap-2 font-mono text-sm uppercase tracking-widest', colorClass)}>
            <span className={cn('status-dot', dotClass)} />
            {status}
        </span>
    )
}

interface RelayPathStepProps {
    label: string
    sublabel?: string
    isFirst?: boolean
}

function RelayPathStep({ label, sublabel, isFirst }: RelayPathStepProps) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            {!isFirst && (
                <ArrowRight
                    size={14}
                    className="text-primary/60 flex-shrink-0"
                />
            )}
            <div className="config-panel !px-3 !py-2 min-w-0">
                <p className="text-xs font-mono text-text-primary truncate">{label}</p>
                {sublabel && (
                    <p className="text-[10px] font-mono text-text-muted truncate mt-0.5">
                        {sublabel}
                    </p>
                )}
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BridgePage() {
    const bridge = useBridge()

    const registryEntries = Object.entries(bridge.registry)

    return (
        <DashboardLayout>
            <PageHeader
                title="Bridge"
                subtitle="Cloud-mediated command relay — external bots to local daemon"
                icon={Radio}
            />

            <div className="px-8 py-6 hud-fade-in space-y-6">

                {/* Row 1: Connection status + Bridge ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Connection Status */}
                    <motion.div
                        className="config-panel"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    >
                        <div className="config-title mb-4 flex items-center justify-between">
                            <span>Connection Status</span>
                            {bridge.isLoading && (
                                <RefreshCw size={13} className="animate-spin text-text-muted" />
                            )}
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            {bridge.bridgeConnected ? (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--opta-neon-green)]/10">
                                    <CheckCircle2 size={20} className="text-[var(--opta-neon-green)]" />
                                </div>
                            ) : bridge.bridgeLifecycleStatus === 'pairing' ? (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--opta-neon-amber)]/10">
                                    <Activity size={20} className="text-[var(--opta-neon-amber)]" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--opta-neon-red)]/10">
                                    <WifiOff size={20} className="text-[var(--opta-neon-red)]" />
                                </div>
                            )}
                            <div>
                                <StatusPill
                                    connected={bridge.bridgeConnected}
                                    status={bridge.bridgeLifecycleStatus}
                                />
                                <p className="text-xs text-text-muted mt-1 font-mono">
                                    {bridge.bridgeConnected
                                        ? 'Relay is active — commands are being forwarded'
                                        : bridge.bridgeLifecycleStatus === 'pairing'
                                            ? 'Pairing in progress…'
                                            : 'Relay offline — no active bridge connection'}
                                </p>
                            </div>
                        </div>

                        {bridge.error && (
                            <div className="flex items-start gap-2 p-2.5 rounded border border-[var(--opta-neon-red)]/25 bg-[var(--opta-neon-red)]/8 mt-2">
                                <AlertCircle size={13} className="text-[var(--opta-neon-red)] mt-0.5 flex-shrink-0" />
                                <p className="text-xs font-mono text-[var(--opta-neon-red)] break-words">
                                    {bridge.error}
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Bridge ID */}
                    <motion.div
                        className="config-panel"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
                    >
                        <div className="config-title mb-4">Bridge Identity</div>

                        {bridge.bridgeId ? (
                            <div className="space-y-3">
                                <div>
                                    <p className="config-label">Agent ID</p>
                                    <p className="font-mono text-xs text-text-secondary break-all mt-1">
                                        {bridge.bridgeId}
                                    </p>
                                </div>
                                {bridge.bridgeName && (
                                    <div>
                                        <p className="config-label">Resolved Name</p>
                                        <p className="font-mono text-sm text-text-primary mt-1">
                                            {bridge.bridgeName}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Unplug size={24} className="text-text-muted opacity-30 mb-3" />
                                <p className="text-sm text-text-muted font-mono">
                                    No paired device — bridge ID unavailable.
                                </p>
                                <p className="text-xs text-text-muted mt-1">
                                    Pair a device via{' '}
                                    <a href="/pair" className="text-primary hover:underline">
                                        Pair Device
                                    </a>{' '}
                                    to enable bridge relay.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Row 2: How it works */}
                <motion.div
                    className="config-panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
                >
                    <div className="config-title mb-4 flex items-center gap-2">
                        <Globe size={14} className="text-primary" />
                        <span>How It Works</span>
                    </div>

                    <p className="text-sm text-text-secondary mb-5">
                        Bridge relay connects external bots to your local daemon via{' '}
                        <span className="font-mono text-text-primary">accounts.optalocal.com</span>.
                        Commands are enqueued in the cloud control plane and forwarded over a
                        secure polling channel to the daemon running on your machine.
                    </p>

                    {/* Relay path diagram */}
                    <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1">
                        <RelayPathStep
                            label="External Bot"
                            sublabel="e.g. Telegram, CLI"
                            isFirst
                        />
                        <RelayPathStep
                            label="accounts.optalocal.com"
                            sublabel="/api/device-commands/stream"
                        />
                        <RelayPathStep
                            label="Daemon"
                            sublabel="127.0.0.1:9999"
                        />
                        <RelayPathStep
                            label="LMX"
                            sublabel="192.168.188.11:1234"
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-text-muted">
                        <div className="p-2.5 rounded bg-[var(--opta-elevated)] border border-[rgba(168,85,247,0.12)]">
                            <p className="text-text-secondary font-semibold mb-1">Auth</p>
                            <p>Bridge token minted during pairing, validated by the daemon</p>
                        </div>
                        <div className="p-2.5 rounded bg-[var(--opta-elevated)] border border-[rgba(168,85,247,0.12)]">
                            <p className="text-text-secondary font-semibold mb-1">Transport</p>
                            <p>SSE polling from daemon to cloud; HTTP responses forwarded back</p>
                        </div>
                        <div className="p-2.5 rounded bg-[var(--opta-elevated)] border border-[rgba(168,85,247,0.12)]">
                            <p className="text-text-secondary font-semibold mb-1">Scope</p>
                            <p>Scoped to device ID — each device gets an isolated command channel</p>
                        </div>
                    </div>
                </motion.div>

                {/* Row 3: Known bridges table */}
                <motion.div
                    className="config-panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.15 }}
                >
                    <div className="config-title mb-4">
                        Known Bridges ({registryEntries.length})
                    </div>

                    {registryEntries.length === 0 ? (
                        <p className="text-sm text-text-muted font-mono">
                            No known bridge registrations.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[rgba(168,85,247,0.15)]">
                                        <th className="text-left pb-2 text-[10px] font-mono uppercase tracking-widest text-text-muted pr-4">
                                            Agent ID
                                        </th>
                                        <th className="text-left pb-2 text-[10px] font-mono uppercase tracking-widest text-text-muted pr-4">
                                            Name
                                        </th>
                                        <th className="text-left pb-2 text-[10px] font-mono uppercase tracking-widest text-text-muted">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registryEntries.map(([agentId, name]) => {
                                        const isActive =
                                            bridge.bridgeConnected &&
                                            bridge.bridgeId === agentId
                                        return (
                                            <tr
                                                key={agentId}
                                                className="border-b border-[rgba(168,85,247,0.08)] last:border-0"
                                            >
                                                <td className="py-2.5 pr-4">
                                                    <span className="font-mono text-xs text-text-secondary break-all">
                                                        {agentId.slice(0, 32)}…
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    <span className="font-mono text-sm text-text-primary">
                                                        {name}
                                                    </span>
                                                </td>
                                                <td className="py-2.5">
                                                    {isActive ? (
                                                        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--opta-neon-green)]">
                                                            <span className="status-dot status-dot-online" />
                                                            active
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                                                            registered
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

            </div>
        </DashboardLayout>
    )
}
