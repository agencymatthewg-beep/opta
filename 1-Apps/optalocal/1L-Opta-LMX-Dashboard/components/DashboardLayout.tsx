'use client'

/**
 * Dashboard shared layout — sidebar navigation + content area.
 * Applied to all /audio, /rag, /skills, /agents, /logs routes.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
    Activity,
    Binary,
    Bot,
    BrainCircuit,
    Braces,
    BookOpen,
    Brain,
    FileText,
    HardDrive,
    Layers,
    Link2,
    MessageSquare,
    Mic,
    Settings,
    Sparkles,
    Stethoscope,
    Terminal,
    Trash2,
} from 'lucide-react'
import { OptaTextLogo } from '@/components/OptaTextLogo'
import { useConnection } from '@/lib/connection'
import { useEventBusLifecycle, useEventBasedRefresh } from '@/hooks/use-events'
import { useLoadedModels } from '@/hooks/use-models'
import { useChat } from '@/hooks/use-chat'

import { HudBackground } from '@/components/HudBackground'

const NAV_GROUPS = [
    {
        label: 'Core',
        items: [
            { href: '/', label: 'Overview', icon: Sparkles },
            { href: '/models', label: 'Models', icon: HardDrive },
            { href: '/quantize', label: 'Quantize', icon: Binary },
        ],
    },
    {
        label: 'Intelligence',
        items: [
            { href: '/agents', label: 'Agents', icon: Bot },
            { href: '/skills', label: 'Skills', icon: Layers },
            { href: '/presets', label: 'Presets', icon: BookOpen },
            { href: '/console', label: 'API Console', icon: Braces },
            { href: '/rag', label: 'Knowledge', icon: Brain },
            { href: '/audio', label: 'Audio', icon: Mic },
        ],
    },
    {
        label: 'Observability',
        items: [
            { href: '/metrics', label: 'Metrics', icon: Activity },
            { href: '/predictor', label: 'Predictor', icon: BrainCircuit },
            { href: '/arena', label: 'Arena', icon: MessageSquare },
            { href: '/benchmark', label: 'Benchmark', icon: Terminal },
            { href: '/sessions', label: 'Sessions', icon: BookOpen },
            { href: '/logs', label: 'Logs', icon: FileText },
            { href: '/diagnostics', label: 'Diagnostics', icon: Stethoscope },
        ],
    },
    {
        label: 'System',
        items: [
            { href: '/setup', label: 'Setup', icon: Stethoscope },
            { href: '/pair', label: 'Pair Device', icon: Link2 },
            { href: '/settings', label: 'Settings', icon: Settings },
        ],
    },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const { status, version, isConnected } = useConnection()
    const { models } = useLoadedModels()
    const [selectedModel, setSelectedModel] = useState('')
    const [chatInput, setChatInput] = useState('')
    const [chatOpen, setChatOpen] = useState(false)
    const chatInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const chat = useChat({ model: selectedModel || undefined })

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

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && event.ctrlKey && !event.metaKey && !event.repeat) {
                event.preventDefault()
                setChatOpen((open) => !open)
            }
            if (event.key === 'Escape') {
                setChatOpen(false)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    useEffect(() => {
        if (!chatOpen) return
        const timer = setTimeout(() => chatInputRef.current?.focus(), 40)
        return () => clearTimeout(timer)
    }, [chatOpen])

    useEffect(() => {
        if (!chatOpen) return
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chat.messages, chatOpen])

    function handleSendMessage() {
        if (!chatInput.trim() || chat.isStreaming || !isConnected) return
        chat.sendMessage(chatInput.trim())
        setChatInput('')
    }

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
                    <div style={{ '--logo-size': '1.1rem', '--logo-sub-size': '0.3rem' } as CSSProperties}>
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

            {/* Ctrl+K chat popup */}
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-[1.5px] transition-opacity duration-200 ${chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setChatOpen(false)}
                aria-hidden={!chatOpen}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Chat popup"
                    onClick={(event) => event.stopPropagation()}
                    className={`glass-strong border border-primary/25 rounded-xl sm:rounded-2xl w-[min(920px,96vw)] h-[min(720px,88vh)] flex flex-col shadow-[0_30px_120px_rgba(0,0,0,0.55)] transition-all duration-200 ${chatOpen ? 'scale-100 translate-y-0' : 'scale-[0.98] translate-y-3'
                        }`}
                >
                    <div className="flex items-center gap-3 border-b border-[var(--opta-border)] px-4 sm:px-5 py-3">
                        <MessageSquare size={15} className="text-primary" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-text-primary">Chat</p>
                            <p className="text-[10px] uppercase tracking-widest text-text-muted">Ctrl+K to toggle</p>
                        </div>

                        <select
                            className="holographic-input text-xs py-1.5 px-3 w-44 sm:w-60"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={!isConnected}
                            title="Model selection"
                        >
                            <option value="">auto</option>
                            {models?.map((model) => (
                                <option key={model.model_id} value={model.model_id}>
                                    {model.model_id}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={chat.clearMessages}
                            className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                            title="Clear messages"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
                        {chat.messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <MessageSquare size={28} className="text-text-muted mb-3 opacity-25" />
                                <p className="text-sm text-text-muted">Send a message to start chatting.</p>
                            </div>
                        )}
                        {chat.messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[88%] sm:max-w-[78%] px-3.5 py-2.5 rounded-xl text-sm ${message.role === 'user'
                                            ? 'bg-primary/20 border border-primary/30 text-white'
                                            : 'config-panel text-text-primary'
                                        }`}
                                >
                                    <pre className="font-mono text-sm whitespace-pre-wrap break-words">
                                        {message.content}
                                    </pre>
                                </div>
                            </div>
                        ))}
                        {chat.isStreaming && (
                            <div className="text-xs text-primary font-mono">streaming…</div>
                        )}
                        {chat.error && (
                            <div className="text-xs text-[var(--opta-neon-red)] font-mono">
                                {chat.error}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-[var(--opta-border)] px-4 sm:px-5 py-3.5">
                        <div className="flex gap-3">
                            <input
                                ref={chatInputRef}
                                className="holographic-input flex-1"
                                placeholder={isConnected ? 'Type a message…' : 'Connect to LMX to chat'}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        handleSendMessage()
                                    }
                                }}
                                disabled={!isConnected}
                            />
                            {chat.isStreaming ? (
                                <button onClick={chat.stopStreaming} className="holographic-btn">
                                    Stop
                                </button>
                            ) : (
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!isConnected || !chatInput.trim()}
                                    className="holographic-btn"
                                >
                                    Send
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
