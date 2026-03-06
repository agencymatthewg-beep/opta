'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    AlertCircle,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Radio,
    RefreshCw,
    Shield,
    WifiOff,
    Zap,
} from 'lucide-react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useBridge } from '@/hooks/use-bridge'
import { cn } from '@/lib/utils'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ connected, status }: { connected: boolean; status: string }) {
    if (connected) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--opta-neon-green)]/15 text-[var(--opta-neon-green)] border border-[var(--opta-neon-green)]/25">
                <span className="status-dot status-dot-online" />
                Active
            </span>
        )
    }
    if (status === 'pairing') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--opta-neon-amber)]/15 text-[var(--opta-neon-amber)] border border-[var(--opta-neon-amber)]/25">
                <span className="status-dot status-dot-loading" />
                Connecting…
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--opta-neon-red)]/15 text-[var(--opta-neon-red)] border border-[var(--opta-neon-red)]/25">
            <WifiOff size={11} />
            Offline
        </span>
    )
}

function TechDisclosure({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="mt-4">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Technical details
            </button>
            {open && (
                <div className="mt-3 p-3 rounded-lg bg-[var(--opta-elevated)] border border-[rgba(168,85,247,0.12)] text-xs font-mono text-text-muted space-y-1">
                    {children}
                </div>
            )}
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BridgePage() {
    const bridge = useBridge()

    const registryEntries = Object.entries(bridge.registry)

    const statusHeading = bridge.bridgeConnected
        ? 'Your bots can reach your AI'
        : bridge.bridgeLifecycleStatus === 'pairing'
            ? 'Connecting your bots…'
            : 'Your bots cannot reach your AI right now'

    const statusBody = bridge.bridgeConnected
        ? 'Commands sent by your bots and apps are being delivered to your AI engine.'
        : bridge.bridgeLifecycleStatus === 'pairing'
            ? 'A secure connection is being established. This usually takes a few seconds.'
            : 'The relay connection is offline. Pair a device to restore access.'

    return (
        <DashboardLayout>
            <PageHeader
                title="Bot Connection"
                subtitle="Lets your bots and apps send commands to your AI from anywhere"
                icon={Radio}
            />

            <div className="px-8 py-6 hud-fade-in space-y-6">

                {/* Status + Actions */}
                <motion.div
                    className="config-panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                >
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            {bridge.bridgeConnected ? (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--opta-neon-green)]/10 flex-shrink-0">
                                    <CheckCircle2 size={20} className="text-[var(--opta-neon-green)]" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--opta-neon-red)]/10 flex-shrink-0">
                                    <WifiOff size={20} className="text-[var(--opta-neon-red)]" />
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold text-text-primary">{statusHeading}</p>
                                <p className="text-xs text-text-muted mt-0.5">{statusBody}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {bridge.isLoading && <RefreshCw size={13} className="animate-spin text-text-muted" />}
                            <StatusBadge connected={bridge.bridgeConnected} status={bridge.bridgeLifecycleStatus} />
                        </div>
                    </div>

                    {!bridge.bridgeConnected && bridge.bridgeLifecycleStatus !== 'pairing' && (
                        <a
                            href="/pair"
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-mono"
                        >
                            Set up pairing →
                        </a>
                    )}

                    {bridge.error && (
                        <div className="flex items-start gap-2 p-2.5 rounded border border-[var(--opta-neon-red)]/25 bg-[var(--opta-neon-red)]/8 mt-3">
                            <AlertCircle size={13} className="text-[var(--opta-neon-red)] mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-mono text-[var(--opta-neon-red)] break-words">
                                {bridge.error}
                            </p>
                        </div>
                    )}

                    <TechDisclosure>
                        <p>Status: <span className="text-text-secondary">{bridge.bridgeLifecycleStatus}</span></p>
                        {bridge.bridgeId && (
                            <p>Device ID: <span className="text-text-secondary break-all">{bridge.bridgeId}</span></p>
                        )}
                        {bridge.bridgeName && (
                            <p>Resolved name: <span className="text-text-secondary">{bridge.bridgeName}</span></p>
                        )}
                        <p>Relay endpoint: <span className="text-text-secondary">accounts.optalocal.com/api/device-commands/stream</span></p>
                    </TechDisclosure>
                </motion.div>

                {/* How it works */}
                <motion.div
                    className="config-panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
                >
                    <div className="config-title mb-4">How it works</div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Bot size={16} className="text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-text-primary">Your bots send a command</p>
                            <p className="text-xs text-text-muted">
                                A Telegram bot, CLI tool, or any connected app triggers an AI request.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Shield size={16} className="text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-text-primary">Securely relayed to your machine</p>
                            <p className="text-xs text-text-muted">
                                The command travels through Opta&apos;s cloud relay, authenticated to your device only.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Zap size={16} className="text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-text-primary">Your AI runs it</p>
                            <p className="text-xs text-text-muted">
                                Your local AI engine processes the command and sends the result back in milliseconds.
                            </p>
                        </div>
                    </div>

                    <TechDisclosure>
                        <p>Transport: <span className="text-text-secondary">SSE push (daemon polls accounts.optalocal.com every 25 s, commands pushed immediately on arrival)</span></p>
                        <p>Auth: <span className="text-text-secondary">Bridge token minted during pairing, validated per-request by the daemon</span></p>
                        <p>Scope: <span className="text-text-secondary">Isolated per device ID — no cross-device command leakage</span></p>
                        <p>Daemon port: <span className="text-text-secondary">127.0.0.1:9999 (loopback) or 0.0.0.0:9999 (LAN, if --lan flag set)</span></p>
                    </TechDisclosure>
                </motion.div>

                {/* Connected sources */}
                {registryEntries.length > 0 && (
                    <motion.div
                        className="config-panel"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
                    >
                        <div className="config-title mb-4">
                            Connected Sources ({registryEntries.length})
                        </div>
                        <p className="text-xs text-text-muted mb-4">
                            Bots and apps registered to send commands through this relay.
                        </p>

                        <div className="space-y-2">
                            {registryEntries.map(([agentId, name]) => {
                                const isActive = bridge.bridgeConnected && bridge.bridgeId === agentId
                                return (
                                    <div
                                        key={agentId}
                                        className={cn(
                                            'flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors',
                                            isActive
                                                ? 'border-[var(--opta-neon-green)]/25 bg-[var(--opta-neon-green)]/5'
                                                : 'border-[rgba(168,85,247,0.12)] bg-[var(--opta-elevated)]'
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Bot size={14} className={isActive ? 'text-[var(--opta-neon-green)]' : 'text-text-muted'} />
                                            <span className="text-sm font-mono text-text-primary truncate">{name}</span>
                                        </div>
                                        {isActive ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--opta-neon-green)] flex-shrink-0">
                                                <span className="status-dot status-dot-online" />
                                                Active now
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted flex-shrink-0">
                                                Registered
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}

            </div>
        </DashboardLayout>
    )
}
