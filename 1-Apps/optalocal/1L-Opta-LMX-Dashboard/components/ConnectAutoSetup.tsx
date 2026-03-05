'use client'

/**
 * ConnectAutoSetup — client component that auto-hydrates the LMX
 * connection from URL params and redirects to the main dashboard once live.
 *
 * Rendered by /connect/page.tsx after URL params are validated.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConnection } from '@/lib/connection'
import { HudRing } from './HudRing'

interface ConnectAutoSetupProps {
    host: string
    port: number
    via: 'lan' | 'wan'
    tunnelUrl?: string
}

export function ConnectAutoSetup({ host, port, via, tunnelUrl }: ConnectAutoSetupProps) {
    const { setUrl, status } = useConnection()
    const router = useRouter()
    const [phase, setPhase] = useState<'connecting' | 'success' | 'failed'>('connecting')
    const [elapsed, setElapsed] = useState(0)
    const didInit = useRef(false)

    // Build the target URL from params
    const targetUrl = via === 'wan' && tunnelUrl
        ? tunnelUrl.replace(/\/+$/, '')
        : `http://${host}:${port}`

    // One-shot connection hydration
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true
        setUrl(targetUrl)
    }, [setUrl, targetUrl])

    // Watch connection status
    useEffect(() => {
        if (status === 'connected') {
            setPhase('success')
            // Brief success flash then redirect
            const t = setTimeout(() => router.replace('/'), 1200)
            return () => clearTimeout(t)
        }
    }, [status, router])

    // Timeout after 12s
    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            const s = Math.floor((Date.now() - start) / 1000)
            setElapsed(s)
            if (s >= 12 && phase === 'connecting') {
                setPhase('failed')
                clearInterval(interval)
            }
        }, 500)
        return () => clearInterval(interval)
    }, [phase])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--opta-void)] p-8 text-center font-sans hud-fade-in relative overflow-hidden">
            {/* Ambient background glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-1000 ${phase === 'connecting' ? 'bg-primary' : phase === 'success' ? 'bg-[var(--opta-neon-green)]' : 'bg-[var(--opta-neon-red)]'
                }`}></div>

            {/* Logo Container with Rings */}
            <div className="relative w-32 h-32 mb-10">
                {/* Outer decorative ring */}
                <div className={`absolute -inset-4 rounded-full border border-dashed opacity-20 transition-all duration-1000 ${phase === 'connecting' ? 'border-primary animate-[spin_10s_linear_infinite]' :
                        phase === 'success' ? 'border-[var(--opta-neon-green)]' : 'border-[var(--opta-neon-red)]'
                    }`}></div>

                {/* Inner continuous ring */}
                <div className={`absolute inset-0 rounded-full border-2 opacity-40 transition-all duration-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] ${phase === 'connecting' ? 'border-primary shadow-[0_0_15px_rgba(168,85,247,0.3)]' :
                        phase === 'success' ? 'border-[var(--opta-neon-green)] shadow-[0_0_20px_rgba(16,185,129,0.5)]' :
                            'border-[var(--opta-neon-red)] shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                    }`}></div>

                {/* The spinning connector */}
                {phase === 'connecting' && (
                    <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary border-r-primary/50 animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
                )}

                {/* Center Icon */}
                <div className={`absolute inset-0 flex items-center justify-center p-6 transition-all duration-700 ${phase === 'success'
                        ? 'hue-rotate-[-90deg] drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] scale-110'
                        : phase === 'failed'
                            ? 'grayscale drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] opacity-60'
                            : 'drop-shadow-[0_0_25px_rgba(168,85,247,0.7)]'
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logos/opta-lmx-mark.svg"
                        className="w-full h-full"
                        alt="LMX Logo"
                    />
                </div>
            </div>

            {/* Status Panel */}
            <div className="config-panel max-w-sm w-full mx-auto relative z-10 backdrop-blur-xl bg-[#020204]/80">
                {phase === 'connecting' && (
                    <div className="flex flex-col items-center">
                        <div className="text-[10px] uppercase font-mono tracking-[0.2em] text-primary/70 mb-3 animate-pulse">Establishing Uplink</div>
                        <p className="text-xl text-text-primary font-semibold mb-2">Connecting to LMX</p>
                        <p className="text-xs text-primary/80 font-mono bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">{targetUrl}</p>
                        <div className="mt-4 flex items-center justify-between w-full pt-4 border-t border-[rgba(168,85,247,0.15)] text-[10px] font-mono uppercase tracking-widest text-text-muted">
                            <span>{via === 'wan' ? 'Via Cloudflare Tunnel' : 'Via Local Network'}</span>
                            <span className="tabular-nums">T+00:{elapsed.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                )}

                {phase === 'success' && (
                    <div className="flex flex-col items-center text-center">
                        <div className="text-[10px] uppercase font-mono tracking-[0.2em] text-[var(--opta-neon-green)]/70 mb-3">Handshake Accepted</div>
                        <p className="text-xl text-[var(--opta-neon-green)] font-semibold mb-2 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">Connection Secure</p>
                        <p className="text-xs text-text-muted font-mono bg-[var(--opta-elevated)]/50 px-3 py-1.5 rounded-md border border-[rgba(16,185,129,0.2)]">Initializing Dashboard</p>
                    </div>
                )}

                {phase === 'failed' && (
                    <div className="flex flex-col items-center text-center">
                        <div className="text-[10px] uppercase font-mono tracking-[0.2em] text-[var(--opta-neon-red)]/70 mb-3">Connection Timeout</div>
                        <p className="text-xl text-[var(--opta-neon-red)] font-semibold mb-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">Target Unreachable</p>
                        <p className="text-xs text-[var(--opta-neon-red)]/80 font-mono mb-6 bg-[var(--opta-neon-red)]/10 px-3 py-1.5 rounded-md border border-[var(--opta-neon-red)]/20 break-all">{targetUrl}</p>

                        <div className="flex flex-col gap-3 w-full">
                            {via === 'lan' && tunnelUrl && (
                                <button
                                    onClick={() => { setUrl(tunnelUrl); setPhase('connecting'); setElapsed(0) }}
                                    className="holographic-btn w-full"
                                >
                                    Reroute via Cloudflare
                                </button>
                            )}
                            <button
                                onClick={() => router.replace('/')}
                                className="w-full text-xs font-mono uppercase tracking-widest text-text-muted hover:text-text-secondary border border-text-muted/20 hover:border-text-muted/40 rounded-lg py-3 transition-colors bg-[var(--opta-elevated)]"
                            >
                                Enter Offline Mode
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
