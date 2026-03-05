'use client'

import { BookOpen, Trash2, Loader2, Clock, MessageSquare } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useSessions } from '@/hooks/use-sessions'
import { deleteSession } from '@/lib/mutations'
import { useState } from 'react'

export default function SessionsPage() {
    const { isConnected } = useConnection()
    const { sessions, total, isLoading, refresh } = useSessions()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function handleDelete(id: string) {
        if (!confirm('Delete this session?')) return
        setDeletingId(id)
        try {
            await deleteSession(id)
            refresh()
        } catch (e) { alert((e as Error).message) }
        finally { setDeletingId(null) }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Sessions"
                subtitle={`CLI session history — ${total} total`}
                icon={BookOpen}
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <BookOpen size={32} className="text-text-muted mb-4 opacity-30" />
                        <p className="text-sm text-text-muted">Connect to LMX to browse sessions.</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center gap-2 text-text-muted text-sm"><Loader2 size={14} className="animate-spin" /> Loading sessions…</div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <BookOpen size={32} className="text-text-muted mb-4 opacity-30" />
                        <p className="text-sm text-text-muted">No sessions found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map(s => (
                            <div key={s.id} className="config-panel flex items-center justify-between">
                                <div className="flex-1 min-w-0 mr-4">
                                    <p className="text-sm font-mono truncate">{s.title ?? s.first_user_message ?? s.id}</p>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted font-mono">
                                        {s.model && <span>model: {s.model}</span>}
                                        <span className="flex items-center gap-1"><MessageSquare size={10} /> {s.message_count}</span>
                                        {s.tags.length > 0 && <span>{s.tags.join(', ')}</span>}
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} /> {new Date(s.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                                    className="p-1.5 text-text-muted hover:text-[var(--opta-neon-red)] transition-colors flex-shrink-0">
                                    {deletingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
