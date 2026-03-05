'use client'

import { Layers, Play, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronRight, Shield, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useSkills, useMcpTools } from '@/hooks/use-skills'
import { executeSkill, callMcpTool } from '@/lib/mutations'
import type { Skill, MCPTool } from '@/lib/types'

function SkillRow({ skill, onSelect }: { skill: Skill; onSelect: () => void }) {
    return (
        <button onClick={onSelect} className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all group mb-2">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate">{skill.qualified_name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold tracking-widest uppercase flex-shrink-0">{skill.kind}</span>
                {skill.risk_tags?.includes('dangerous') && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--opta-neon-red)]/20 text-[var(--opta-neon-red)] font-mono font-bold tracking-widest uppercase flex-shrink-0 flex items-center gap-1">
                        <Shield size={9} />risk
                    </span>
                )}
            </div>
            <p className="text-[10px] text-text-muted line-clamp-1 font-mono uppercase tracking-wide opacity-80">{skill.description}</p>
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
        try { args = JSON.parse(argsJson) } catch { setExecError('Invalid JSON format'); return }
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
            <div className="flex h-[calc(100vh-120px)] hud-fade-in p-6 pt-0">
                <div className="flex w-full config-panel p-0 overflow-hidden">
                    {/* List panel */}
                    <div className="w-80 flex-shrink-0 border-r border-[rgba(168,85,247,0.2)] bg-[var(--opta-void)]/40 flex flex-col relative z-10 backdrop-blur-md">
                        <div className="flex border-b border-[rgba(168,85,247,0.2)]">
                            {(['skills', 'mcp'] as const).map(tab => (
                                <button key={tab} onClick={() => { setActiveTab(tab); setSelected(null) }}
                                    className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/10 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)]' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'}`}>
                                    {tab === 'skills' ? `Opta Skills (${skills.length})` : `MCP Tools (${mcpTools.length})`}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)]/30">
                            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">{activeTab === 'skills' ? skills.length : mcpTools.length} Available</span>
                            <button onClick={() => activeTab === 'skills' ? refreshSkills() : refreshMcp()} className="p-1.5 rounded-full text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                                <RefreshCw size={12} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 relative">
                            {!isConnected && <div className="flex items-center gap-3 text-[var(--opta-neon-amber)] text-xs p-3 rounded-lg border border-[var(--opta-neon-amber)]/20 bg-[var(--opta-neon-amber)]/5 mb-3"><AlertCircle size={14} /><span className="font-mono uppercase tracking-widest text-[10px]">Connect to LMX</span></div>}
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-muted">
                                    <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                                    <span className="text-[10px] font-mono uppercase tracking-widest">Scanning Registry…</span>
                                </div>
                            ) : activeTab === 'skills'
                                ? skills.map(s => <SkillRow key={s.qualified_name} skill={s} onSelect={() => { setSelected(s); setArgsJson('{}'); setResult(null); setExecError(null) }} />)
                                : mcpTools.map((t, idx) => (
                                    <button key={`${t.name}-${idx}`} onClick={() => { setSelected(t); setArgsJson('{}'); setResult(null); setExecError(null) }}
                                        className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all mb-2 group">
                                        <p className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate mb-1.5">{t.name}</p>
                                        <p className="text-[10px] text-text-muted line-clamp-2 font-mono uppercase tracking-wide opacity-80">{t.description}</p>
                                    </button>
                                ))
                            }
                        </div>
                    </div>

                    {/* Execute panel */}
                    <div className="flex-1 overflow-y-auto p-8 relative bg-[#020204]">
                        {/* Subtle background grid */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1]" style={{ backgroundImage: 'linear-gradient(rgba(168,85,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

                        <div className="relative z-[2] h-full">
                            {!selected ? (
                                <div className="h-full flex items-center justify-center text-text-muted">
                                    <div className="text-center">
                                        <Layers size={32} className="mx-auto mb-4 text-primary/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                                        <p className="text-[10px] font-mono tracking-widest uppercase">Select an endpoint capability to execute</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="pb-4 border-b border-[rgba(168,85,247,0.3)]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-[var(--opta-neon-green)] shadow-[0_0_8px_var(--opta-neon-green)] animate-pulse"></div>
                                            <h2 className="text-lg font-mono font-bold text-primary tracking-wide">{'qualified_name' in selected ? selected.qualified_name : selected.name}</h2>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed font-mono opacity-80">{selected.description}</p>
                                    </div>

                                    <div>
                                        <label className="config-label mb-2 flex justify-between items-center">
                                            <span>Arguments Payload (JSON)</span>
                                            <span className="text-[10px] text-text-muted opacity-50">Strict schema required</span>
                                        </label>
                                        <textarea
                                            className="holographic-input w-full font-mono text-xs leading-relaxed"
                                            rows={8}
                                            value={argsJson}
                                            onChange={e => setArgsJson(e.target.value)}
                                            disabled={executing}
                                            spellCheck={false}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-[var(--opta-elevated)]/50 border border-[rgba(168,85,247,0.2)] rounded-xl relative overflow-hidden">
                                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary"></div>
                                        <label className="flex items-center gap-3 cursor-pointer select-none ml-2">
                                            <div className="relative flex items-center justify-center">
                                                <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} className="peer sr-only" />
                                                <div className="w-4 h-4 rounded border border-text-muted peer-checked:border-primary peer-checked:bg-primary transition-colors flex items-center justify-center">
                                                    <CheckCircle size={10} className="text-white opacity-0 peer-checked:opacity-100 placeholder" />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-mono font-bold tracking-wide text-text-primary">Pre-Approve Action</span>
                                                <span className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mt-0.5">Bypass safety prompt</span>
                                            </div>
                                        </label>
                                        <button onClick={handleExecute} disabled={!isConnected || executing}
                                            className="holographic-btn flex items-center gap-2 h-10 px-6 disabled:opacity-50">
                                            {executing ? <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> Transmitting…</> : <><Play size={14} /> Send Execution</>}
                                        </button>
                                    </div>

                                    {execError && (
                                        <div className="p-3 border-l-2 border-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10 text-[var(--opta-neon-red)] flex items-center gap-3 rounded-r-lg">
                                            <AlertCircle size={14} />
                                            <p className="text-xs font-mono tracking-wide">{execError}</p>
                                        </div>
                                    )}

                                    {result && (
                                        <div className="border border-[rgba(168,85,247,0.2)] rounded-xl overflow-hidden bg-[var(--opta-elevated)]/80 relative">
                                            {/* Results header */}
                                            <div className={`p-3 border-b flex items-center gap-3 ${result.ok ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]' : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]'}`}>
                                                {result.ok ? <CheckCircle size={16} className="text-[var(--opta-neon-green)]" /> : <XCircle size={16} className="text-[var(--opta-neon-red)]" />}
                                                <span className={`text-xs font-mono uppercase tracking-widest font-bold ${result.ok ? 'text-[var(--opta-neon-green)]' : 'text-[var(--opta-neon-red)]'}`}>
                                                    {result.ok ? 'Execution Returned OK' : 'Execution Failed'}
                                                </span>
                                                {result.duration_ms && <span className="ml-auto text-[10px] font-mono text-text-muted tracking-widest">{result.duration_ms} ms</span>}
                                            </div>

                                            <div className="p-4 space-y-3">
                                                {result.requires_approval && !approved && (
                                                    <div className="flex items-center gap-2 text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10 p-2 rounded text-[10px] font-mono uppercase tracking-widest border border-[var(--opta-neon-amber)]/20">
                                                        <AlertCircle size={12} />
                                                        <span>Block rule triggered. Enable pre-approval and execute again.</span>
                                                    </div>
                                                )}

                                                {result.output !== undefined && (
                                                    <div>
                                                        <p className="text-[10px] font-mono uppercase tracking-widest text-[rgba(168,85,247,0.8)] mb-2">Payload Output</p>
                                                        <pre className="text-[10px] font-mono bg-[#020204] border border-[rgba(168,85,247,0.15)] p-4 rounded-lg overflow-auto max-h-96 text-primary whitespace-pre-wrap shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] leading-relaxed">
                                                            {JSON.stringify(result.output, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}

                                                {result.error && (
                                                    <div>
                                                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--opta-neon-red)] mb-2">Error Trace</p>
                                                        <p className="text-xs font-mono text-[var(--opta-neon-red)] bg-[#020204] p-3 rounded-lg border border-[var(--opta-neon-red)]/20">{result.error}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
