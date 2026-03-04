'use client'

import { Brain, Database, Plus, Trash2, Search, Upload, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useConnection } from '@/lib/connection'
import { useRagCollections } from '@/hooks/use-rag'
import { ingestDocuments, queryRag, deleteRagCollection } from '@/lib/mutations'

function PageHeader({ title, subtitle, icon: Icon }: {
    title: string; subtitle: string; icon: React.ElementType
}) {
    return (
        <div className="border-b border-[var(--opta-border)] px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                </div>
                <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            <p className="text-sm text-text-secondary ml-12">{subtitle}</p>
        </div>
    )
}

export default function RagPage() {
    const { isConnected } = useConnection()
    const { collections, totalDocuments, collectionCount, isLoading, refresh } = useRagCollections()

    // Ingest
    const [ingestCollection, setIngestCollection] = useState('')
    const [ingestText, setIngestText] = useState('')
    const [ingestLoading, setIngestLoading] = useState(false)
    const [ingestResult, setIngestResult] = useState<string | null>(null)
    const [ingestError, setIngestError] = useState<string | null>(null)

    // Query
    const [queryCollection, setQueryCollection] = useState('')
    const [queryText, setQueryText] = useState('')
    const [queryK, setQueryK] = useState(5)
    const [queryLoading, setQueryLoading] = useState(false)
    const [queryResults, setQueryResults] = useState<Array<{ text: string; score: number }>>([])
    const [queryError, setQueryError] = useState<string | null>(null)

    // Delete
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

    async function handleIngest() {
        if (!ingestCollection.trim() || !ingestText.trim()) return
        setIngestLoading(true)
        setIngestResult(null)
        setIngestError(null)
        try {
            const res = await ingestDocuments({
                collection: ingestCollection.trim(),
                documents: [ingestText],
                chunking: 'auto',
            })
            setIngestResult(`✓ Ingested ${res.documents_ingested} doc — ${res.chunks_created} chunks in ${res.duration_ms}ms`)
            setIngestText('')
            refresh()
        } catch (e) {
            setIngestError((e as Error).message)
        } finally {
            setIngestLoading(false)
        }
    }

    async function handleQuery() {
        if (!queryCollection.trim() || !queryText.trim()) return
        setQueryLoading(true)
        setQueryResults([])
        setQueryError(null)
        try {
            const res = await queryRag({
                collection: queryCollection.trim(),
                query: queryText,
                top_k: queryK,
                rerank: false,
            })
            setQueryResults(res.results.map(r => ({ text: r.text, score: r.score })))
        } catch (e) {
            setQueryError((e as Error).message)
        } finally {
            setQueryLoading(false)
        }
    }

    async function handleDelete(collection: string) {
        if (!confirm(`Delete collection "${collection}" and all its documents?`)) return
        setDeleteLoading(collection)
        try {
            await deleteRagCollection(collection)
            refresh()
        } catch (e) {
            alert((e as Error).message)
        } finally {
            setDeleteLoading(null)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Knowledge Base"
                subtitle="RAG document ingestion, semantic search, and collection management"
                icon={Brain}
            />

            <div className="px-8 py-6 space-y-6">
                {!isConnected && (
                    <div className="dashboard-card flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to manage knowledge bases.</span>
                    </div>
                )}

                {/* Collections overview */}
                <div className="dashboard-card">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-primary" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                                Collections
                            </h2>
                        </div>
                        <div className="flex gap-4 text-xs font-mono text-text-muted">
                            <span>{collectionCount} collections</span>
                            <span>{totalDocuments} documents</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-2 text-text-muted text-sm">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading collections…</span>
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="text-center py-8 text-text-muted">
                            <Database size={28} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No collections yet. Ingest some documents below.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {collections.map((col) => (
                                <div key={col.name}
                                    className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[var(--opta-elevated)] border border-[var(--opta-border)]">
                                    <div>
                                        <p className="text-sm font-mono text-text-primary">{col.name}</p>
                                        <p className="text-xs text-text-muted mt-0.5">
                                            {col.document_count} docs · {col.embedding_dimensions}d vectors
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setQueryCollection(col.name); setQueryText('') }}
                                            className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                            title="Query this collection"
                                        >
                                            <Search size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(col.name)}
                                            disabled={deleteLoading === col.name}
                                            className="p-1.5 rounded text-text-muted hover:text-[var(--opta-neon-red)] hover:bg-[var(--opta-neon-red)]/10 transition-colors disabled:opacity-40"
                                            title="Delete collection"
                                        >
                                            {deleteLoading === col.name
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <Trash2 size={13} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Ingest */}
                    <div className="dashboard-card">
                        <div className="flex items-center gap-2 mb-5">
                            <Upload size={16} className="text-primary" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                                Ingest Documents
                            </h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Collection name</label>
                                <input
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                                    placeholder="my-collection"
                                    value={ingestCollection}
                                    onChange={(e) => setIngestCollection(e.target.value)}
                                    disabled={!isConnected || ingestLoading}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Document text</label>
                                <textarea
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-muted"
                                    rows={5}
                                    placeholder="Paste document content to index…"
                                    value={ingestText}
                                    onChange={(e) => setIngestText(e.target.value)}
                                    disabled={!isConnected || ingestLoading}
                                />
                            </div>
                            <button
                                onClick={handleIngest}
                                disabled={!isConnected || ingestLoading || !ingestCollection.trim() || !ingestText.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus size={14} />
                                {ingestLoading ? 'Ingesting…' : 'Ingest'}
                            </button>
                            {ingestResult && <p className="text-xs text-[var(--opta-neon-green)] font-mono">{ingestResult}</p>}
                            {ingestError && <p className="text-xs text-[var(--opta-neon-red)] font-mono">{ingestError}</p>}
                        </div>
                    </div>

                    {/* Query */}
                    <div className="dashboard-card">
                        <div className="flex items-center gap-2 mb-5">
                            <Search size={16} className="text-primary" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                                Semantic Search
                            </h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Collection</label>
                                <input
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                                    placeholder="my-collection"
                                    value={queryCollection}
                                    onChange={(e) => setQueryCollection(e.target.value)}
                                    disabled={!isConnected || queryLoading}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Query</label>
                                <textarea
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-muted"
                                    rows={3}
                                    placeholder="What do you want to find?"
                                    value={queryText}
                                    onChange={(e) => setQueryText(e.target.value)}
                                    disabled={!isConnected || queryLoading}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-text-muted whitespace-nowrap">Top K</label>
                                    <input
                                        type="number"
                                        min={1} max={20}
                                        className="w-16 bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-primary/50"
                                        value={queryK}
                                        onChange={(e) => setQueryK(Number(e.target.value))}
                                    />
                                </div>
                                <button
                                    onClick={handleQuery}
                                    disabled={!isConnected || queryLoading || !queryCollection.trim() || !queryText.trim()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Search size={14} />
                                    {queryLoading ? 'Searching…' : 'Search'}
                                </button>
                            </div>
                            {queryError && <p className="text-xs text-[var(--opta-neon-red)] font-mono">{queryError}</p>}
                        </div>

                        {queryResults.length > 0 && (
                            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                                {queryResults.map((r, i) => (
                                    <div key={i} className="p-3 bg-[var(--opta-elevated)] rounded-lg border border-[var(--opta-border)]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ChevronRight size={11} className="text-primary" />
                                            <span className="text-xs font-mono text-primary">score: {r.score.toFixed(4)}</span>
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{r.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
