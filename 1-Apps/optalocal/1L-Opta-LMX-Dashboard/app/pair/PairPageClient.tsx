'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, Link2, ShieldCheck } from 'lucide-react'
import type { ActivationState } from '@opta/protocol-shared'
import {
    AccountsControlPlaneError,
    claimPairingSession,
    createPairingSession,
    getPairingSession,
    mintBridgeToken,
} from '@/lib/accounts-control-plane'
import { usePairedDevice } from '@/lib/paired-device'
import { useConnection } from '@/lib/connection'

const ACCOUNTS_SIGN_IN = 'https://accounts.optalocal.com/sign-in'

function buildEndpoint(host: string | null, port: string | null): string | null {
    if (!host || !port) return null
    const parsedPort = Number.parseInt(port, 10)
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) return null
    return `http://${host}:${parsedPort}`
}

export default function PairPage() {
    const router = useRouter()
    const search = useSearchParams()
    const pairedDevice = usePairedDevice()
    const { setUrl } = useConnection()

    const querySessionId = search.get('session')
    const queryDeviceId = search.get('deviceId')
    const queryHost = search.get('host')
    const queryPort = search.get('port')
    const endpointFromQuery = useMemo(
        () => buildEndpoint(queryHost, queryPort),
        [queryHost, queryPort],
    )

    const [sessionId, setSessionId] = useState(querySessionId ?? '')
    const [deviceLabel, setDeviceLabel] = useState(() =>
        typeof navigator === 'undefined' ? 'Opta LMX Device' : navigator.platform || 'Opta LMX Device',
    )
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusLine, setStatusLine] = useState<string>('Ready to start pairing.')

    async function ensureSignedIn<T>(run: () => Promise<T>): Promise<T | null> {
        try {
            return await run()
        } catch (err) {
            if (err instanceof AccountsControlPlaneError && err.status === 401) {
                setError('Sign in required. Continue in Opta Accounts, then return to this page.')
                const returnTo = `${window.location.origin}/pair${window.location.search}`
                const signInUrl = `${ACCOUNTS_SIGN_IN}?redirect_to=${encodeURIComponent(returnTo)}`
                window.open(signInUrl, '_blank', 'noopener,noreferrer')
                return null
            }
            throw err
        }
    }

    async function hydrateExistingSession(): Promise<void> {
        const targetSessionId = sessionId.trim()
        if (!targetSessionId) return
        setBusy(true)
        setError(null)
        setStatusLine('Checking pairing session…')
        try {
            const envelope = await ensureSignedIn(() => getPairingSession(targetSessionId))
            if (!envelope) return
            const session = envelope.session
            if (session.status !== 'claimed') {
                const recoveryAction = envelope.metadata?.recoveryAction
                const recoveryText = recoveryAction
                    ? ` Next action: ${recoveryAction.replaceAll('_', ' ')}.`
                    : ''
                setStatusLine(`Session status: ${session.status}.${recoveryText}`)
                return
            }
            pairedDevice.setPairedState({
                session,
                bridgeToken: pairedDevice.bridgeToken,
                endpointUrl: endpointFromQuery ?? pairedDevice.endpointUrl,
                bridgeStatus: {
                    status: 'connected',
                    activationState: 'bridge_connected',
                    reason: null,
                    lastSeenAt: new Date().toISOString(),
                },
            })
            const targetUrl = endpointFromQuery ?? pairedDevice.endpointUrl
            if (targetUrl) {
                setUrl(targetUrl)
            }
            setStatusLine('Pairing session confirmed. Redirecting to setup…')
            router.push('/setup')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch pairing session')
        } finally {
            setBusy(false)
        }
    }

    async function startPairingFlow(): Promise<void> {
        setBusy(true)
        setError(null)
        setStatusLine('Creating pairing session…')
        try {
            const created = await ensureSignedIn(() =>
                createPairingSession({
                    deviceId: queryDeviceId ?? undefined,
                    deviceLabel,
                    capabilityScopes: ['device.commands.consume', 'device.commands.issue', 'lmx.admin'],
                }),
            )
            if (!created) return

            setSessionId(created.session.id)
            setStatusLine('Claiming pairing session…')
            const claimed = await ensureSignedIn(() =>
                claimPairingSession(created.session.id, {
                    deviceId: queryDeviceId ?? created.session.deviceId ?? undefined,
                    deviceLabel,
                }),
            )
            if (!claimed) return

            let bridgeToken: string | null = null
            let activationState: ActivationState = claimed.metadata?.state ?? 'pairing_claimed'
            if (claimed.session.deviceId) {
                setStatusLine('Minting bridge token…')
                const minted = await ensureSignedIn(() =>
                    mintBridgeToken({
                        deviceId: claimed.session.deviceId!,
                        scopes: ['device.commands.consume', 'device.commands.issue', 'lmx.admin'],
                    }),
                )
                bridgeToken = minted?.token ?? null
                if (minted?.metadata?.state === 'bridge_connected') {
                    activationState = 'bridge_connected'
                }
            }

            pairedDevice.setPairedState({
                session: claimed.session,
                bridgeToken,
                endpointUrl: endpointFromQuery,
                bridgeStatus: {
                    status: 'connected',
                    activationState,
                    reason: null,
                    lastSeenAt: new Date().toISOString(),
                },
            })
            if (endpointFromQuery) setUrl(endpointFromQuery)
            setStatusLine('Pairing completed. Redirecting to setup…')
            router.push('/setup')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Pairing failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <main className="min-h-screen px-6 py-10 md:px-10 md:py-14">
            <div className="max-w-3xl mx-auto space-y-6">
                <header className="config-panel">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg border border-primary/35 bg-primary/10 flex items-center justify-center">
                            <Link2 size={16} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-mono text-text-primary">Pair This Device</h1>
                            <p className="text-sm text-text-secondary mt-1">
                                Complete secure pairing so this dashboard can fully manage and debug your local Opta LMX runtime.
                            </p>
                        </div>
                    </div>
                </header>

                <section className="config-panel space-y-4">
                    <div>
                        <label className="config-label block mb-1">Pairing Session ID</label>
                        <input
                            className="holographic-input w-full"
                            value={sessionId}
                            onChange={(event) => setSessionId(event.target.value)}
                            placeholder="session UUID (optional)"
                        />
                    </div>
                    <div>
                        <label className="config-label block mb-1">Device Label</label>
                        <input
                            className="holographic-input w-full"
                            value={deviceLabel}
                            onChange={(event) => setDeviceLabel(event.target.value)}
                            placeholder="My MacBook Pro"
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button className="holographic-btn" onClick={() => void startPairingFlow()} disabled={busy}>
                            <ShieldCheck size={14} />
                            <span>{busy ? 'Working…' : 'Start Pairing'}</span>
                        </button>
                        <button
                            className="holographic-btn"
                            onClick={() => void hydrateExistingSession()}
                            disabled={busy || !sessionId.trim()}
                        >
                            <KeyRound size={14} />
                            <span>Use Existing Session</span>
                        </button>
                    </div>

                    <div className="text-xs font-mono text-text-muted">
                        {statusLine}
                    </div>
                    {error && (
                        <div className="text-xs font-mono text-[var(--opta-neon-red)]">{error}</div>
                    )}
                </section>

                <section className="config-panel">
                    <h2 className="config-title">Current Pairing State</h2>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-text-secondary">
                        {JSON.stringify(
                            {
                                mode: pairedDevice.mode,
                                sessionId: pairedDevice.session?.id ?? null,
                                deviceId: pairedDevice.session?.deviceId ?? null,
                                endpointUrl: pairedDevice.endpointUrl,
                                bridgeStatus: pairedDevice.bridgeStatus.status,
                            },
                            null,
                            2,
                        )}
                    </pre>
                </section>
            </div>
        </main>
    )
}
