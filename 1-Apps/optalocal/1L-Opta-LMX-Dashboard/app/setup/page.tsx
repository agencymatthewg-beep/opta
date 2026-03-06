'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, TriangleAlert, Wrench } from 'lucide-react'
import { usePairedDevice } from '@/lib/paired-device'
import { useConnection } from '@/lib/connection'
import type { SetupCheck } from '@/lib/types'

export default function SetupPage() {
    const router = useRouter()
    const pairedDevice = usePairedDevice()
    const connection = useConnection()

    const checks = useMemo<SetupCheck[]>(() => {
        const usingPairedMode = pairedDevice.mode === 'paired'
        return [
            {
                id: 'pairing-session',
                title: 'Pairing Session',
                status: pairedDevice.session ? 'passed' : 'failed',
                detail: pairedDevice.session
                    ? `Session ${pairedDevice.session.id} is attached.`
                    : 'No pairing session found.',
                actionId: pairedDevice.session ? null : 'go-pair',
            },
            {
                id: 'bridge-status',
                title: 'Bridge Link',
                status:
                    pairedDevice.bridgeStatus.status === 'connected'
                        ? 'passed'
                        : pairedDevice.bridgeStatus.status === 'pairing'
                            ? 'pending'
                            : 'failed',
                detail: `Bridge state: ${pairedDevice.bridgeStatus.status}`,
                actionId: pairedDevice.bridgeStatus.status === 'connected' ? null : 'retry-pair',
            },
            {
                id: 'endpoint',
                title: 'Runtime Endpoint',
                status:
                    !usingPairedMode || pairedDevice.endpointUrl
                        ? 'passed'
                        : 'failed',
                detail:
                    usingPairedMode && !pairedDevice.endpointUrl
                        ? 'Missing paired endpoint URL.'
                        : `Endpoint: ${connection.url}`,
                actionId:
                    usingPairedMode && !pairedDevice.endpointUrl
                        ? 'direct-fallback'
                        : null,
            },
            {
                id: 'lmx-connectivity',
                title: 'LMX Connectivity',
                status: connection.isConnected ? 'passed' : 'pending',
                detail: connection.isConnected
                    ? 'LMX health check is online.'
                    : connection.error ?? 'Waiting for LMX health check.',
                actionId: connection.isConnected ? null : 'open-settings',
            },
        ]
    }, [pairedDevice, connection])

    const allPassed = checks.every((check) => check.status === 'passed')

    return (
        <main className="min-h-screen px-6 py-10 md:px-10 md:py-14">
            <div className="max-w-3xl mx-auto space-y-6">
                <header className="config-panel">
                    <h1 className="text-xl font-mono text-text-primary">Device Setup</h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Verify pairing, bridge connectivity, and LMX runtime readiness before using the full dashboard.
                    </p>
                </header>

                <section className="config-panel space-y-3">
                    {checks.map((check) => (
                        <div
                            key={check.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--opta-border)]"
                        >
                            <div className="flex items-start gap-3">
                                {check.status === 'passed' ? (
                                    <CheckCircle2 size={16} className="text-[var(--opta-neon-green)] mt-0.5" />
                                ) : (
                                    <TriangleAlert size={16} className="text-[var(--opta-neon-amber)] mt-0.5" />
                                )}
                                <div>
                                    <p className="text-sm font-mono text-text-primary">{check.title}</p>
                                    <p className="text-xs text-text-muted mt-1">{check.detail}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="config-panel">
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            className="holographic-btn"
                            disabled={!allPassed}
                            onClick={() => router.push('/')}
                        >
                            <CheckCircle2 size={14} />
                            <span>Enter Dashboard</span>
                        </button>
                        <Link className="holographic-btn" href="/pair">
                            <Wrench size={14} />
                            <span>Back To Pairing</span>
                        </Link>
                        <button
                            className="holographic-btn"
                            onClick={() => {
                                pairedDevice.switchToDirectMode()
                                router.push('/settings')
                            }}
                        >
                            <span>Use Direct Connect Fallback</span>
                        </button>
                    </div>
                    {!allPassed && (
                        <p className="text-xs text-text-muted font-mono mt-4">
                            Complete the pending checks or use direct-connect fallback in Settings.
                        </p>
                    )}
                </section>
            </div>
        </main>
    )
}
