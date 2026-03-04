'use client'

import { Layers, Play, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronRight, Shield, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useConnection } from '@/lib/connection'
import { useSkills, useMcpTools } from '@/hooks/use-skills'
import { executeSkill, callMcpTool } from '@/lib/mutations'
import type { Skill, MCPTool } from '@/lib/types'

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

function SkillRow({ skill, onSelect }: { skill: Skill; onSelect: () => void }) {
    return (
        <button onClick={onSelect} className="w-full text-left p-3 rounded-lg border border-[var(--opta-border)] bg-[var(--opta-elevated)] hover:border-primary/30 transition-all group">
            <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-mono text-text-primary truncate">{skill.qualified_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono flex-shrink-0">{skill.kind}</span>
                {skill.risk_tags?.includes('dangerous') && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--opta-neon-red)]/15 text-[var(--opta-neon-red)] font-mono flex-shrink-0 flex items-center gap-1">
                        <Shield size={9} />risk
                    </span>
                )}
            </div>
            <p className="text-xs text-text-muted line-clamp-1">{skill.description}</p>
        </button>
    )
}

export default function SkillsPage() {
    const { isConnected } = useConnection()
    const { skills, isLoading: skillsLoading, refresh: refreshSkills } = useSkills(true)
    const { tools: mcpTools, isLoading: mcpLoading, refresh: refreshMcp } = useMcpTools()

    const [activeTab, setActiveTab] = useState<'skills' | 'mcp'>('skills')
    const [selected, setSelected] = useState<Skill | MCPTool | null>(null)
    const [argsJson, setArgsJson] = useState('{}')
    const [approved, setApproved] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; output?: unknown; error?: string; duration_ms?: number; requires_approval?: boolean } | null>(null)
    const [execError, setExecError] = useState<string | null>(null)

    async function handleExecute() {
        if (!selected) return
        let args: Record<string, unknown>
        try { args = JSON.parse(argsJson) } catch { setExecError('Invalid JSON'); return }
        setExecuting(true); setResult(null); setExecError(null)
        try {
            if (activeTab === 'skills') {
                const r = await executeSkill((selected as Skill).qualified_name, args, approved)
                setResult(r)
            } else {
                const r = await callMcpTool((selected as MCPTool).name, args, approved)
                setResult(r)
            }
        } catch (e) { setExecError((e as Error).message) }
        finally { setExecuting(false) }
    }

    const isLoading = activeTab === 'skills' ? skillsLoading : mcpLoading

    return (
        <DashboardLayout>
            <PageHeader title="Skills & MCP" subtitle="Skill registry, MCP tool browser, and execution playground" icon={Layers} />
            <div className="flex h-[calc(100vh-120px)]">
                {/* List panel */}
                <div className="w-72 flex-shrink-0 border-r border-[var(--opta-border)] flex flex-col">
                    <div className="flex border-b border-[var(--opta-border)]">
                        {(['skills', 'mcp'] as const).map(tab => (
                            <button key={tab} onClick={() => { setActiveTab(tab); setSelected(null) }}
                                className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                                {tab === 'skills' ? `Skills (${skills.length})` : `MCP (${mcpTools.length})`}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--opta-border)]">
                        <span className="text-xs text-text-muted">{activeTab === 'skills' ? skills.length : mcpTools.length} items</span>
                        <button onClick={() => activeTab === 'skills' ? refreshSkills() : refreshMcp()} className="p-1 text-text-muted hover:text-text-secondary">
                            <RefreshCw size={11} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {!isConnected && <div className="flex items-center gap-2 text-[var(--opta-neon-amber)] text-xs p-2"><AlertCircle size={12} /><span>Connect to LMX</span></div>}
                        {isLoading ? <div className="flex items-center gap-2 text-text-muted text-xs p-2"><Loader2 size={12} className="animate-spin" /><span>Loading…</span></div>
                            : activeTab === 'skills'
                                ? skills.map(s => <SkillRow key={s.qualified_name} skill={s} onSelect={() => { setSelected(s); setArgsJson('{}'); setResult(null); setExecError(null) }} />)
                                : mcpTools.map(t => (
                                    <button key={t.name} onClick={() => { setSelected(t); setArgsJson('{}'); setResult(null); setExecError(null) }}
                                        className="w-full text-left p-3 rounded-lg border border-[var(--opta-border)] bg-[var(--opta-elevated)] hover:border-primary/30 transition-all">
                                        <p className="text-sm font-mono text-text-primary truncate">{t.name}</p>
                                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{t.description}</p>
                                    </button>
                                ))
                        }
                    </div>
                </div>

                {/* Execute panel */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!selected ? (
                        <div className="h-full flex items-center justify-center text-text-muted">
                            <div className="text-center"><Layers size={28} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Select an item to execute</p></div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-xl">
                            <div>
                                <h2 className="text-base font-mono font-semibold">{'qualified_name' in selected ? selected.qualified_name : selected.name}</h2>
                                <p className="text-sm text-text-secondary mt-1">{selected.description}</p>
                            </div>
                            <div className="dashboard-card space-y-3">
                                <label className="text-xs text-text-muted block">Arguments (JSON)</label>
                                <textarea className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 text-text-primary" rows={5} value={argsJson} onChange={e => setArgsJson(e.target.value)} disabled={executing} spellCheck={false} />
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} className="accent-purple-500" />
                                        <span className="text-xs text-text-secondary">Pre-approve execution</span>
                                    </label>
                                    <button onClick={handleExecute} disabled={!isConnected || executing}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
                                        <Play size={14} />{executing ? 'Running…' : 'Execute'}
                                    </button>
                                </div>
                            </div>
                            {execError && <div className="dashboard-card flex items-center gap-3 text-[var(--opta-neon-red)]"><XCircle size={14} /><p className="text-sm font-mono">{execError}</p></div>}
                            {result && (
                                <div className="dashboard-card space-y-3">
                                    <div className="flex items-center gap-2">
                                        {result.ok ? <CheckCircle size={14} className="text-[var(--opta-neon-green)]" /> : <XCircle size={14} className="text-[var(--opta-neon-red)]" />}
                                        <span className="text-sm font-medium">{result.ok ? 'Success' : 'Failed'}</span>
                                        {result.duration_ms && <span className="ml-auto text-xs font-mono text-text-muted">{result.duration_ms}ms</span>}
                                    </div>
                                    {result.requires_approval && !approved && <p className="text-xs text-[var(--opta-neon-amber)] font-mono">⚠ Requires approval — enable checkbox and re-run</p>}
                                    {result.output !== undefined && (
                                        <pre className="text-xs font-mono bg-[var(--opta-elevated)] p-3 rounded-lg overflow-auto max-h-48 text-text-primary whitespace-pre-wrap">{JSON.stringify(result.output, null, 2)}</pre>
                                    )}
                                    {result.error && <p className="text-xs text-[var(--opta-neon-red)] font-mono">{result.error}</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
