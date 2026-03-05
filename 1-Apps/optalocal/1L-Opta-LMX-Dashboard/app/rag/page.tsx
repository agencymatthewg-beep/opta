'use client'

import { Brain, Database, Plus, Trash2, Search, Upload, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useRagCollections } from '@/hooks/use-rag'
import { ingestDocuments, queryRag, deleteRagCollection } from '@/lib/mutations'

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

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono tracking-wide">Connect to LMX to manage knowledge bases.</span>
                    </div>
                )}

                {/* Collections overview */}
                <div className="config-panel">
                    <div className="flex items-center justify-between mb-5">
                        <div className="config-title flex items-center gap-2 m-0 p-0 border-0 bg-transparent">
                            <Database size={14} className="text-primary" />
                            Collections
                        </div>
                        <div className="flex gap-4 text-[10px] uppercase font-mono tracking-wider text-text-muted">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">{collectionCount} DBs</span>
                            <span className="bg-[var(--opta-elevated)] text-text-secondary px-2 py-0.5 rounded border border-[rgba(168,85,247,0.15)]">{totalDocuments} DOCS</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-10 gap-3 text-text-muted text-sm font-mono">
                            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                            <span className="uppercase tracking-widest text-[10px]">Loading Collections…</span>
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="text-center py-12 text-text-muted">
                            <Database size={32} className="mx-auto mb-4 opacity-20 text-primary drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                            <p className="text-xs font-mono tracking-widest uppercase">No collections mapped. Ingest documents below.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {collections.map((col) => (
                                <div key={col.name}
                                    className="flex flex-col py-3 px-4 rounded-xl bg-[var(--opta-elevated)]/40 border border-[rgba(168,85,247,0.2)] hover:border-primary/50 transition-colors relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex items-start justify-between relative z-10 mb-2">
                                        <p className="text-sm font-mono text-primary font-semibold tracking-wide truncate pr-2">{col.name}</p>
                                        <button
                                            onClick={() => handleDelete(col.name)}
                                            disabled={deleteLoading === col.name}
                                            className="p-1 rounded text-text-muted hover:text-[var(--opta-neon-red)] hover:bg-[var(--opta-neon-red)]/10 transition-colors disabled:opacity-40"
                                            title="Delete collection"
                                        >
                                            {deleteLoading === col.name
                                                ? <Loader2 size={13} className="animate-spin text-[var(--opta-neon-red)]" />
                                                : <Trash2 size={13} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest mt-auto relative z-10">
                                        <span className="text-text-secondary">{col.document_count} docs</span>
                                        <span className="text-text-muted">·</span>
                                        <span className="text-text-muted">{col.embedding_dimensions}d vectors</span>
                                        <button
                                            onClick={() => { setQueryCollection(col.name); setQueryText(''); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }}
                                            className="ml-auto p-1.5 rounded-full text-text-muted hover:text-primary hover:bg-primary/20 transition-colors"
                                            title="Query this collection"
                                        >
                                            <Search size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Ingest */}
                    <div className="config-panel flex flex-col">
                        <div className="config-title flex items-center gap-2">
                            <Upload size={14} className="text-primary" />
                            Ingest Documents
                        </div>
                        <div className="space-y-4 flex-1 flex flex-col">
                            <div>
                                <label className="config-label">Collection Name</label>
                                <input
                                    className="holographic-input w-full"
                                    placeholder="e.g. documentation-v1"
                                    value={ingestCollection}
                                    onChange={(e) => setIngestCollection(e.target.value)}
                                    disabled={!isConnected || ingestLoading}
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="config-label">Document Text</label>
                                <textarea
                                    className="holographic-input w-full flex-1 resize-none"
                                    rows={6}
                                    placeholder="Paste document content to index chunks into the collection…"
                                    value={ingestText}
                                    onChange={(e) => setIngestText(e.target.value)}
                                    disabled={!isConnected || ingestLoading}
                                />
                            </div>
                            <button
                                onClick={handleIngest}
                                disabled={!isConnected || ingestLoading || !ingestCollection.trim() || !ingestText.trim()}
                                className="holographic-btn w-full flex items-center justify-center gap-2 mt-2 h-10"
                            >
                                {ingestLoading ? <><Loader2 size={14} className="animate-spin" /> Ingesting…</> : <><Plus size={14} /> Commit to Knowledge Base</>}
                            </button>
                            {ingestResult && <p className="text-xs text-[var(--opta-neon-green)] font-mono text-center">{ingestResult}</p>}
                            {ingestError && <p className="text-xs text-[var(--opta-neon-red)] font-mono text-center">{ingestError}</p>}
                        </div>
                    </div>

                    {/* Query */}
                    <div className="config-panel flex flex-col">
                        <div className="config-title flex items-center gap-2">
                            <Search size={14} className="text-primary" />
                            Semantic Search
                        </div>
                        <div className="space-y-4 flex-1 flex flex-col">
                            <div>
                                <label className="config-label">Target Collection</label>
                                <input
                                    className="holographic-input w-full"
                                    placeholder="e.g. documentation-v1"
                                    value={queryCollection}
                                    onChange={(e) => setQueryCollection(e.target.value)}
                                    disabled={!isConnected || queryLoading}
                                />
                            </div>
                            <div>
                                <label className="config-label">Query Prompt</label>
                                <textarea
                                    className="holographic-input w-full resize-none"
                                    rows={3}
                                    placeholder="What do you want to find or extract from the corpus?"
                                    value={queryText}
                                    onChange={(e) => setQueryText(e.target.value)}
                                    disabled={!isConnected || queryLoading}
                                />
                            </div>
                            <div className="flex items-end gap-4 mt-2">
                                <div className="w-24">
                                    <label className="config-label">Top K</label>
                                    <input
                                        type="number"
                                        min={1} max={20}
                                        className="holographic-input w-full"
                                        value={queryK}
                                        onChange={(e) => setQueryK(Number(e.target.value))}
                                    />
                                </div>
                                <button
                                    onClick={handleQuery}
                                    disabled={!isConnected || queryLoading || !queryCollection.trim() || !queryText.trim()}
                                    className="holographic-btn flex-1 flex items-center justify-center gap-2 h-10"
                                >
                                    {queryLoading ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><Search size={14} /> Run Vector Search</>}
                                </button>
                            </div>
                            {queryError && <p className="text-xs text-[var(--opta-neon-red)] font-mono mt-2">{queryError}</p>}
                        </div>

                        {queryResults.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-[rgba(168,85,247,0.15)] max-h-64 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                <div className="text-[10px] uppercase font-mono tracking-widest text-text-muted mb-2">Search Results ({queryResults.length})</div>
                                {queryResults.map((r, i) => (
                                    <div key={i} className="p-3 bg-[var(--opta-elevated)]/50 rounded-lg border border-[rgba(168,85,247,0.1)] relative group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent rounded-l-lg opacity-50"></div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <ChevronRight size={11} className="text-primary" />
                                            <span className="text-[10px] uppercase tracking-widest font-mono text-primary">distance: {r.score.toFixed(4)}</span>
                                        </div>
                                        <p className="text-xs font-mono text-text-primary leading-relaxed break-words">{r.text}</p>
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
