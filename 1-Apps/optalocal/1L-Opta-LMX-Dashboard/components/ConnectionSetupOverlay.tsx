'use client'

/**
 * ConnectionSetupOverlay — first-run setup panel that appears on the homepage
 * when no LMX endpoint has been configured in localStorage.
 *
 * Guides the user through entering their LMX endpoint URL and optional
 * admin key, then tests the connection before dismissing.
 */

import { useCallback, useRef, useState } from 'react'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { useConnection } from '@/lib/connection'
import {
    checkConnection,
    setLmxUrl,
    setAdminKey as setApiAdminKey,
    getLmxUrl,
} from '@/lib/api'

type Phase = 'input' | 'testing' | 'success' | 'failed'

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234'

export function ConnectionSetupOverlay() {
    const { setUrl, setAdminKey } = useConnection()
    const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
    const [adminKeyInput, setAdminKeyInput] = useState('')
    const [phase, setPhase] = useState<Phase>('input')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const prevUrlRef = useRef(getLmxUrl())

    const handleConnect = useCallback(async () => {
        const cleaned = endpoint.trim().replace(/\/+$/, '')
        if (!cleaned) {
            setErrorMsg('Endpoint URL is required.')
            return
        }

        setPhase('testing')
        setErrorMsg(null)

        // Set URL in the API module for testing — don't persist to localStorage yet
        const prevUrl = prevUrlRef.current
        setLmxUrl(cleaned)
        const key = adminKeyInput.trim() || null
        if (key) setApiAdminKey(key)

        const result = await checkConnection()

        if (result.connected) {
            // Now persist to localStorage via context
            setUrl(cleaned)
            if (key) setAdminKey(key)
            setPhase('success')
        } else {
            // Restore previous URL in the API module
            setLmxUrl(prevUrl)
            setPhase('failed')
            setErrorMsg(result.error ?? 'Could not reach LMX at this endpoint.')
        }
    }, [endpoint, adminKeyInput, setUrl, setAdminKey])

    const handleRetry = useCallback(() => {
        setPhase('input')
        setErrorMsg(null)
    }, [])

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center hud-fade-in">
            {/* Logo */}
            <div className="relative w-24 h-24 mb-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logos/opta-lmx-mark.svg"
                    className="w-20 h-20 mx-auto drop-shadow-[0_0_15px_rgba(139,92,246,0.6)] relative z-10"
                    alt="LMX"
                />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            </div>

            <h2 className="text-lg font-semibold mb-2">Connect to Opta LMX</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-8">
                Enter the endpoint of your Opta LMX inference server to begin.
            </p>

            {/* Setup Panel */}
            <div className="config-panel max-w-md w-full mx-auto">
                <div className="config-title">Connection Setup</div>
                <div className="space-y-4">
                    <div>
                        <p className="config-label">LMX Endpoint</p>
                        <input
                            type="text"
                            className="holographic-input"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="http://192.168.188.11:1234"
                            disabled={phase === 'testing' || phase === 'success'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && phase === 'input') handleConnect()
                            }}
                        />
                    </div>
                    <div>
                        <p className="config-label">Admin Key (optional)</p>
                        <input
                            type="password"
                            className="holographic-input"
                            value={adminKeyInput}
                            onChange={(e) => setAdminKeyInput(e.target.value)}
                            placeholder="••••••••"
                            disabled={phase === 'testing' || phase === 'success'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && phase === 'input') handleConnect()
                            }}
                        />
                    </div>

                    {/* Status indicator */}
                    {phase === 'testing' && (
                        <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-primary">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Testing connection...</span>
                        </div>
                    )}

                    {phase === 'success' && (
                        <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-[var(--opta-neon-green)]">
                            <Wifi size={14} />
                            <span>Connected — loading dashboard</span>
                        </div>
                    )}

                    {phase === 'failed' && errorMsg && (
                        <div className="flex items-center gap-2 py-2 text-xs font-mono text-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10 border border-[var(--opta-neon-red)]/20 px-3 rounded-md">
                            <WifiOff size={14} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Action buttons */}
                    {phase === 'input' && (
                        <button
                            onClick={handleConnect}
                            className="holographic-btn w-full"
                        >
                            Test & Connect
                        </button>
                    )}

                    {phase === 'failed' && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleRetry}
                                className="holographic-btn flex-1"
                            >
                                Edit & Retry
                            </button>
                            <button
                                onClick={handleConnect}
                                className="holographic-btn flex-1"
                            >
                                Retry Now
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Help text */}
            <p className="text-xs text-text-muted font-mono mt-6 max-w-sm">
                Your LMX server runs on your Mac Studio or local machine.
                Find the IP and port in the Opta CLI with{' '}
                <code className="text-primary/80">opta serve status</code>.
            </p>
        </div>
    )
}
