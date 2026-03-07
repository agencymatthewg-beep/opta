'use client'

import {
    AlertCircle,
    FileText,
    Loader2,
    RefreshCw,
    Download,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import {
    useSessionLogs,
    useUpdateLogs,
    useSessionLog,
    useUpdateLog,
} from '@/hooks/use-logs'
import type { LogFileEntry } from '@/lib/types'

type LogTab = 'sessions' | 'updates'

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
}

function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

function LogFileList({
    logs,
    isLoading,
    selectedFilename,
    onSelect,
}: {
    logs: LogFileEntry[]
    isLoading: boolean
    selectedFilename: string | null
    onSelect: (filename: string) => void
}) {
    if (isLoading && logs.length === 0) {
        return (
            <div className="flex items-center gap-2 py-6 text-text-muted text-sm font-mono">
                <Loader2 size={14} className="animate-spin" /> Loading logs…
            </div>
        )
    }
    if (logs.length === 0) {
        return (
            <div className="py-10 text-center">
                <FileText size={24} className="text-text-muted opacity-30 mx-auto mb-3" />
                <p className="text-sm text-text-muted font-mono">No log files found.</p>
            </div>
        )
    }
    return (
        <div className="space-y-1.5 max-h-[72vh] overflow-y-auto pr-1">
            {logs.map((entry) => (
                <button
                    key={entry.filename}
                    onClick={() => onSelect(entry.filename)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        selectedFilename === entry.filename
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-[rgba(168,85,247,0.18)] hover:border-primary/30 hover:bg-white/5'
                    }`}
                >
                    <p className="text-sm font-mono text-text-primary truncate">
                        {entry.filename}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                        <span>{formatBytes(entry.size_bytes)}</span>
                        <span>·</span>
                        <span>{formatDate(entry.created_at)}</span>
                    </div>
                </button>
            ))}
        </div>
    )
}

function SessionLogViewer({ filename }: { filename: string }) {
    const { content, isLoading, error, refresh } = useSessionLog(filename)
    return <LogViewer filename={filename} content={content} isLoading={isLoading} error={error} onRefresh={refresh} />
}

function UpdateLogViewer({ filename }: { filename: string }) {
    const { content, isLoading, error, refresh } = useUpdateLog(filename)
    return <LogViewer filename={filename} content={content} isLoading={isLoading} error={error} onRefresh={refresh} />
}

function LogViewer({
    filename,
    content,
    isLoading,
    error,
    onRefresh,
}: {
    filename: string
    content: string | null
    isLoading: boolean
    error: unknown
    onRefresh: () => void
}) {
    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--opta-border)]">
                <p className="text-xs font-mono text-text-muted truncate flex-1 mr-3">{filename}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {content && (
                        <button
                            onClick={() => downloadText(filename, content)}
                            className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
                            title="Download file"
                        >
                            <Download size={13} />
                        </button>
                    )}
                    <button
                        onClick={onRefresh}
                        className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={13} />
                    </button>
                </div>
            </div>

            {isLoading && !content ? (
                <div className="flex items-center justify-center flex-1 gap-2 text-text-muted text-sm font-mono">
                    <Loader2 size={14} className="animate-spin" /> Loading log…
                </div>
            ) : error ? (
                <div className="flex items-center gap-2 text-[var(--opta-neon-red)] text-sm font-mono">
                    <AlertCircle size={14} />
                    <span>{(error as Error).message}</span>
                </div>
            ) : !content ? (
                <div className="flex items-center justify-center flex-1 text-sm text-text-muted font-mono">
                    Empty file.
                </div>
            ) : (
                <pre className="flex-1 text-xs font-mono text-text-secondary whitespace-pre-wrap break-words overflow-y-auto leading-relaxed max-h-[62vh]">
                    {content}
                </pre>
            )}
        </div>
    )
}

export default function LogsPage() {
    const { isConnected } = useConnection()
    const [activeTab, setActiveTab] = useState<LogTab>('sessions')
    const [selectedFilename, setSelectedFilename] = useState<string | null>(null)

    const {
        logs: sessionLogs,
        isLoading: sessionLoading,
        error: sessionError,
        refresh: refreshSessionLogs,
    } = useSessionLogs()

    const {
        logs: updateLogs,
        isLoading: updateLoading,
        error: updateError,
        refresh: refreshUpdateLogs,
    } = useUpdateLogs()

    const activeLogs = activeTab === 'sessions' ? sessionLogs : updateLogs
    const activeError = activeTab === 'sessions' ? sessionError : updateError

    // Auto-select first file when tab or log list changes
    useEffect(() => {
        if (activeLogs.length > 0) {
            setSelectedFilename(activeLogs[0].filename)
        } else {
            setSelectedFilename(null)
        }
    }, [activeTab, activeLogs])

    function handleTabChange(tab: LogTab) {
        setActiveTab(tab)
        setSelectedFilename(null)
    }

    function handleRefresh() {
        if (activeTab === 'sessions') {
            refreshSessionLogs()
        } else {
            refreshUpdateLogs()
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Logs"
                subtitle="Session and update log files from the LMX engine"
                icon={FileText}
                action={
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh log list"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <FileText size={32} className="text-text-muted mb-4 opacity-30" />
                        <p className="text-sm text-text-muted font-mono">
                            Connect to LMX to view logs.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tab bar */}
                        <div className="flex gap-2 mb-6">
                            {(['sessions', 'updates'] as LogTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => handleTabChange(tab)}
                                    className={`px-4 py-1.5 rounded text-xs font-mono uppercase tracking-widest transition-colors ${
                                        activeTab === tab
                                            ? 'bg-primary text-white'
                                            : 'bg-[var(--opta-elevated)] text-text-muted hover:text-text-secondary'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {activeError && (
                            <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-red)] mb-6">
                                <AlertCircle size={16} />
                                <span className="text-sm font-mono">
                                    {(activeError as Error).message}
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                            {/* File list */}
                            <div className="config-panel">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="config-title mb-0">
                                        {activeTab === 'sessions' ? 'Session Logs' : 'Update Logs'}
                                    </div>
                                    <span className="text-xs font-mono text-text-muted">
                                        {activeLogs.length}
                                    </span>
                                </div>
                                <LogFileList
                                    logs={activeLogs}
                                    isLoading={activeTab === 'sessions' ? sessionLoading : updateLoading}
                                    selectedFilename={selectedFilename}
                                    onSelect={setSelectedFilename}
                                />
                            </div>

                            {/* Content viewer */}
                            <div className="config-panel">
                                {!selectedFilename ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <FileText size={28} className="text-text-muted opacity-20 mb-3" />
                                        <p className="text-sm text-text-muted font-mono">
                                            Select a log file to view its contents.
                                        </p>
                                    </div>
                                ) : activeTab === 'sessions' ? (
                                    <SessionLogViewer filename={selectedFilename} />
                                ) : (
                                    <UpdateLogViewer filename={selectedFilename} />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
