'use client'

import {
    BookOpen,
    Trash2,
    Loader2,
    Clock,
    MessageSquare,
    Search,
    RefreshCw,
    AlertCircle,
    Tag,
} from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import {
    useSession,
    useSessionSearch,
    useSessions,
} from '@/hooks/use-sessions'
import { deleteSession } from '@/lib/mutations'
import { useEffect, useMemo, useState } from 'react'

export default function SessionsPage() {
    const { isConnected } = useConnection()
    const {
        sessions,
        total,
        isLoading,
        error,
        refresh: refreshSessions,
    } = useSessions()

    const [query, setQuery] = useState('')
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
        null
    )
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const trimmedQuery = query.trim()
    const isSearching = trimmedQuery.length > 0

    const {
        results: searchResults,
        error: searchError,
        isLoading: searchLoading,
        refresh: refreshSearch,
    } = useSessionSearch(isSearching ? trimmedQuery : null, 100)

    const {
        session: selectedSession,
        error: selectedSessionError,
        isLoading: selectedSessionLoading,
        refresh: refreshSelectedSession,
    } = useSession(selectedSessionId)

    const visibleSessions = useMemo(
        () => (isSearching ? searchResults ?? [] : sessions),
        [isSearching, searchResults, sessions]
    )
    const listLoading = isSearching ? searchLoading : isLoading
    const listError = isSearching ? searchError : error

    useEffect(() => {
        if (visibleSessions.length === 0) {
            setSelectedSessionId(null)
            return
        }
        if (
            !selectedSessionId ||
            !visibleSessions.some(s => s.id === selectedSessionId)
        ) {
            setSelectedSessionId(visibleSessions[0].id)
        }
    }, [selectedSessionId, visibleSessions])

    async function handleDelete(id: string) {
        if (!confirm('Delete this session?')) return
        setDeletingId(id)
        try {
            await deleteSession(id)
            if (selectedSessionId === id) {
                setSelectedSessionId(null)
            }
            refreshSessions()
            if (isSearching) {
                refreshSearch()
            }
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Sessions"
                subtitle={`CLI session history — ${total} total`}
                icon={BookOpen}
                action={
                    <button
                        onClick={() => {
                            refreshSessions()
                            if (isSearching) refreshSearch()
                            if (selectedSessionId) refreshSelectedSession()
                        }}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh sessions"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <BookOpen
                            size={32}
                            className="text-text-muted mb-4 opacity-30"
                        />
                        <p className="text-sm text-text-muted">
                            Connect to LMX to browse sessions.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
                        {/* Sessions list */}
                        <div className="config-panel">
                            <div className="config-title mb-3">Sessions</div>
                            <div className="relative mb-3">
                                <Search
                                    size={13}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                                />
                                <input
                                    className="holographic-input w-full pl-9 pr-3"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search title, prompt, or content…"
                                />
                            </div>

                            {listError && (
                                <div className="mb-3 p-2 rounded border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 text-xs text-[var(--opta-neon-red)] font-mono">
                                    {(listError as Error).message ??
                                        'Failed to load sessions.'}
                                </div>
                            )}

                            {listLoading ? (
                                <div className="flex items-center gap-2 text-text-muted text-sm py-2">
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />{' '}
                                    Loading sessions…
                                </div>
                            ) : visibleSessions.length === 0 ? (
                                <div className="py-10 text-center">
                                    <BookOpen
                                        size={24}
                                        className="text-text-muted opacity-30 mx-auto mb-3"
                                    />
                                    <p className="text-sm text-text-muted font-mono">
                                        {isSearching
                                            ? 'No matching sessions.'
                                            : 'No sessions found.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                                    {visibleSessions.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() =>
                                                setSelectedSessionId(s.id)
                                            }
                                            onKeyDown={e => {
                                                if (
                                                    e.key === 'Enter' ||
                                                    e.key === ' '
                                                ) {
                                                    e.preventDefault()
                                                    setSelectedSessionId(s.id)
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            className={`w-full text-left config-panel !p-3 transition-colors ${selectedSessionId === s.id
                                                ? 'border-primary/60 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]'
                                                : 'hover:border-primary/30'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-mono truncate">
                                                        {s.title ??
                                                            s.first_user_message ??
                                                            s.id}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-muted font-mono">
                                                        {s.model && (
                                                            <span>
                                                                model: {s.model}
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <MessageSquare
                                                                size={10}
                                                            />{' '}
                                                            {s.message_count}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={10} />{' '}
                                                            {new Date(
                                                                s.updated_at
                                                            ).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        handleDelete(s.id)
                                                    }}
                                                    disabled={
                                                        deletingId === s.id
                                                    }
                                                    className="p-1.5 text-text-muted hover:text-[var(--opta-neon-red)] transition-colors flex-shrink-0 disabled:opacity-50"
                                                    title="Delete session"
                                                >
                                                    {deletingId === s.id ? (
                                                        <Loader2
                                                            size={13}
                                                            className="animate-spin"
                                                        />
                                                    ) : (
                                                        <Trash2 size={13} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Inspector */}
                        <div className="config-panel">
                            <div className="config-title mb-3">
                                Session Inspector
                            </div>

                            {!selectedSessionId ? (
                                <div className="py-12 text-center text-text-muted text-sm font-mono">
                                    Select a session to inspect full message
                                    history.
                                </div>
                            ) : selectedSessionLoading && !selectedSession ? (
                                <div className="flex items-center gap-2 text-text-muted text-sm py-8">
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />
                                    Loading session details…
                                </div>
                            ) : selectedSessionError ? (
                                <div className="p-3 rounded border border-[var(--opta-neon-red)]/30 bg-[var(--opta-neon-red)]/10 text-[var(--opta-neon-red)] text-xs font-mono">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle
                                            size={14}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <p className="font-semibold mb-1">
                                                Failed to load selected session.
                                            </p>
                                            <p>
                                                {
                                                    (selectedSessionError as Error)
                                                        .message
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : !selectedSession ? (
                                <p className="text-sm text-text-muted font-mono py-8">
                                    Session data unavailable.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-mono text-text-primary break-all">
                                            {selectedSession.title ??
                                                selectedSession.first_user_message ??
                                                selectedSession.id}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                                            <div>
                                                <p className="opacity-70">
                                                    Session ID
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1 break-all">
                                                    {selectedSession.id}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Model
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {selectedSession.model ??
                                                        'n/a'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Created
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {new Date(
                                                        selectedSession.created_at
                                                    ).toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="opacity-70">
                                                    Updated
                                                </p>
                                                <p className="text-text-secondary normal-case tracking-normal mt-1">
                                                    {new Date(
                                                        selectedSession.updated_at
                                                    ).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedSession.tags.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Tag
                                                size={12}
                                                className="text-text-muted"
                                            />
                                            {selectedSession.tags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[var(--opta-elevated)] text-text-muted border border-[rgba(168,85,247,0.18)]"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-2">
                                            Messages (
                                            {selectedSession.messages.length})
                                        </h3>
                                        {selectedSession.messages.length ===
                                            0 ? (
                                                <p className="text-xs text-text-muted font-mono">
                                                    No messages in this session.
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                                                    {selectedSession.messages.map(
                                                        (m, idx) => (
                                                            <div
                                                                key={`${m.role}-${idx}`}
                                                                className="border border-[rgba(168,85,247,0.15)] rounded p-2"
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${m.role === 'assistant'
                                                                        ? 'text-primary bg-primary/10'
                                                                        : m.role ===
                                                                            'user'
                                                                            ? 'text-[var(--opta-neon-green)] bg-[var(--opta-neon-green)]/10'
                                                                            : 'text-text-muted bg-[var(--opta-elevated)]'
                                                                        }`}>
                                                                        {m.role}
                                                                    </span>
                                                                    <span className="text-[10px] text-text-muted font-mono">
                                                                        #{idx + 1}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                                                                    {m.content ??
                                                                        '[no text content]'}
                                                                </p>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
