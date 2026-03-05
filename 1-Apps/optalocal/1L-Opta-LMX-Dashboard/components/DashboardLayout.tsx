'use client'

/**
 * Dashboard shared layout — sidebar navigation + content area.
 * Applied to all /audio, /rag, /skills, /agents, /logs routes.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
    Activity,
    Bot,
    BookOpen,
    Brain,
    Database,
    FileText,
    HardDrive,
    Layers,
    MessageSquare,
    Mic,
    Settings,
    Sparkles,
    Stethoscope,
    Terminal,
    Zap,
} from 'lucide-react'
import { OptaTextLogo } from '@/components/OptaTextLogo'
import { useConnection } from '@/lib/connection'
import { useEventBusLifecycle, useEventBasedRefresh } from '@/hooks/use-events'

import { HudBackground } from '@/components/HudBackground'

const NAV_GROUPS = [
    {
        label: 'Core',
        items: [
            { href: '/', label: 'Overview', icon: Sparkles },
            { href: '/models', label: 'Models', icon: HardDrive },
            { href: '/chat', label: 'Chat', icon: MessageSquare },
        ],
    },
    {
        label: 'Intelligence',
        items: [
            { href: '/agents', label: 'Agents', icon: Bot },
            { href: '/skills', label: 'Skills', icon: Layers },
            { href: '/rag', label: 'Knowledge', icon: Brain },
            { href: '/audio', label: 'Audio', icon: Mic },
        ],
    },
    {
        label: 'Observability',
        items: [
            { href: '/metrics', label: 'Metrics', icon: Activity },
            { href: '/benchmark', label: 'Benchmark', icon: Terminal },
            { href: '/sessions', label: 'Sessions', icon: BookOpen },
            { href: '/logs', label: 'Logs', icon: FileText },
            { href: '/diagnostics', label: 'Diagnostics', icon: Stethoscope },
        ],
    },
    {
        label: 'System',
        items: [
            { href: '/settings', label: 'Settings', icon: Settings },
        ],
    },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const { status, version } = useConnection()

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
                : 'offline'

    return (
        <div className="flex h-screen overflow-hidden">
            <HudBackground />
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[var(--opta-border)] glass-subtle">
                {/* Logo */}
                <div className="px-5 py-4 border-b border-[var(--opta-border)] flex items-center gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logos/opta-lmx-mark.svg" className="w-[20px] h-[20px] drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" alt="LMX" />
                    </div>
                    <div style={{ '--logo-size': '1.1rem', '--logo-sub-size': '0.3rem' } as React.CSSProperties}>
                        <OptaTextLogo />
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="mb-6">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2 px-2">
                                {group.label}
                            </p>
                            {group.items.map(({ href, label, icon: Icon }) => {
                                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-all ${isActive
                                            ? 'bg-primary/15 text-primary border border-primary/20'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                            }`}
                                    >
                                        <Icon size={15} className="flex-shrink-0" />
                                        <span>{label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                {/* Status footer */}
                <div className="px-4 py-3 border-t border-[var(--opta-border)] flex items-center gap-2">
                    <span className={`status-dot ${statusDotClass}`} />
                    <span className="text-xs text-text-muted font-mono truncate">{statusLabel}</span>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    )
}
