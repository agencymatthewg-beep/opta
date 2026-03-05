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
            const t = setTimeout(() => router.replace('/'), 800)
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
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: '2.5rem',
                padding: '2rem',
                background: '#09090b',
                fontFamily: 'Sora, sans-serif',
            }}
        >
            {/* Opta Ring */}
            <div
                style={{
                    position: 'relative',
                    width: '80px',
                    height: '80px',
                }}
            >
                {/* Outer ring — always animating */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        border: `2px solid ${phase === 'success' ? '#10b981' : phase === 'failed' ? '#ef4444' : '#8b5cf6'}`,
                        opacity: 0.25,
                    }}
                />
                {/* Spinning arc */}
                {phase === 'connecting' && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderTopColor: '#8b5cf6',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                )}
                {/* Centre Logo */}
                <div
                    style={{
                        position: 'absolute',
                        inset: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.4s ease',
                        filter: phase === 'success'
                            ? 'drop-shadow(0 0 12px rgba(16,185,129,0.6)) hue-rotate(-90deg)'
                            : phase === 'failed'
                                ? 'drop-shadow(0 0 12px rgba(239,68,68,0.6)) grayscale(100%) brightness(2)'
                                : 'drop-shadow(0 0 12px rgba(139,92,246,0.6))',
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logos/opta-lmx-mark.svg"
                        style={{
                            width: '100%',
                            height: '100%',
                            opacity: phase === 'failed' ? 0.7 : 1,
                            transition: 'opacity 0.4s ease'
                        }}
                        alt="LMX Logo"
                    />
                </div>
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center', maxWidth: '380px' }}>
                {phase === 'connecting' && (
                    <>
                        <p style={{ color: '#fafafa', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                            Connecting to LMX…
                        </p>
                        <p style={{ color: '#71717a', fontSize: '0.85rem', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                            {targetUrl}
                        </p>
                        <p style={{ color: '#52525b', fontSize: '0.78rem', margin: '0.75rem 0 0' }}>
                            {via === 'wan' ? '↑ via Cloudflare Tunnel' : '↑ via LAN'}
                            {elapsed > 0 && ` · ${elapsed}s`}
                        </p>
                    </>
                )}
                {phase === 'success' && (
                    <>
                        <p style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                            Connected
                        </p>
                        <p style={{ color: '#71717a', fontSize: '0.85rem', margin: 0 }}>
                            Opening dashboard…
                        </p>
                    </>
                )}
                {phase === 'failed' && (
                    <>
                        <p style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                            Could not connect
                        </p>
                        <p style={{ color: '#71717a', fontSize: '0.85rem', margin: '0 0 1.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                            {targetUrl}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {via === 'lan' && tunnelUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUrl(tunnelUrl)
                                        setPhase('connecting')
                                        setElapsed(0)
                                    }}
                                    style={{
                                        background: 'rgba(139,92,246,0.15)',
                                        border: '1px solid rgba(139,92,246,0.4)',
                                        color: '#a855f7',
                                        borderRadius: '8px',
                                        padding: '0.5rem 1.25rem',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontFamily: 'Sora, sans-serif',
                                    }}
                                >
                                    Try Tunnel Instead
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.replace('/')}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(63,63,70,0.6)',
                                    color: '#a1a1aa',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1.25rem',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    fontFamily: 'Sora, sans-serif',
                                }}
                            >
                                Open Dashboard Anyway
                            </button>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600&family=JetBrains+Mono&display=swap');
            `}</style>
        </div>
    )
}
