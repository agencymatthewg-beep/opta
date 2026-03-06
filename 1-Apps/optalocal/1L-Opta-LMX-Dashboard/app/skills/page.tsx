'use client'

import {
    AlertCircle,
    CheckCircle,
    Database,
    Layers,
    MessageSquareText,
    Play,
    RefreshCw,
    Server,
    Shield,
    Wrench,
    XCircle,
} from 'lucide-react'
import { useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import {
    useMcpCapabilities,
    useMcpPrompts,
    useMcpResources,
    useMcpTools,
    useSkills,
} from '@/hooks/use-skills'
import { useConnection } from '@/lib/connection'
import {
    callMcpTool,
    executeSkill,
    getMcpPrompt,
    readMcpResource,
} from '@/lib/mutations'
import type {
    MCPPrompt,
    MCPResource,
    MCPTool,
    Skill,
} from '@/lib/types'

type MainTab = 'skills' | 'mcp'
type McpView = 'tools' | 'prompts' | 'resources' | 'capabilities'

interface ActionResult {
    title: string
    ok: boolean
    payload?: unknown
    error?: string
    durationMs?: number
    requiresApproval?: boolean
}

interface ParsedArguments {
    payload: Record<string, unknown> | string
    notice: string | null
}

function parseArgumentsInput(raw: string): ParsedArguments {
    const trimmed = raw.trim()
    if (!trimmed) {
        return { payload: {}, notice: null }
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return {
                payload: parsed as Record<string, unknown>,
                notice: null,
            }
        }

        if (typeof parsed === 'string') {
            return {
                payload: parsed.trim(),
                notice:
                    'Arguments were parsed as a string value and will be sent for server-side JSON coercion.',
            }
        }

        return {
            payload: trimmed,
            notice:
                'Arguments should be a JSON object. Sending raw input for server-side validation.',
        }
    } catch {
        return {
            payload: trimmed,
            notice:
                'Invalid JSON object. Sending raw input for server-side parsing fallback.',
        }
    }
}

function parsePromptArguments(raw: string): {
    args: Record<string, unknown>
    notice: string | null
} {
    const parsed = parseArgumentsInput(raw)
    if (typeof parsed.payload !== 'string') {
        return { args: parsed.payload, notice: parsed.notice }
    }

    const token = parsed.payload.trim()
    if (!token) {
        return { args: {}, notice: parsed.notice }
    }

    try {
        const asObject = JSON.parse(token) as unknown
        if (asObject !== null && typeof asObject === 'object' && !Array.isArray(asObject)) {
            return {
                args: asObject as Record<string, unknown>,
                notice: parsed.notice,
            }
        }
    } catch {
        // no-op
    }

    return {
        args: {},
        notice:
            parsed.notice
            ?? 'Prompt arguments must be a JSON object. Falling back to empty arguments.',
    }
}

function SkillRow({ skill, onSelect }: { skill: Skill; onSelect: () => void }) {
    return (
        <button
            onClick={onSelect}
            className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all group mb-2"
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate">
                    {skill.qualified_name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold tracking-widest uppercase flex-shrink-0">
                    {skill.kind}
                </span>
                {skill.risk_tags?.includes('dangerous') && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--opta-neon-red)]/20 text-[var(--opta-neon-red)] font-mono font-bold tracking-widest uppercase flex-shrink-0 flex items-center gap-1">
                        <Shield size={9} />risk
                    </span>
                )}
            </div>
            <p className="text-[10px] text-text-muted line-clamp-1 font-mono uppercase tracking-wide opacity-80">
                {skill.description}
            </p>
        </button>
    )
}

function ActionResultPanel({
    result,
    approved,
}: {
    result: ActionResult
    approved: boolean
}) {
    return (
        <div className="border border-[rgba(168,85,247,0.2)] rounded-xl overflow-hidden bg-[var(--opta-elevated)]/80 relative">
            <div
                className={`p-3 border-b flex items-center gap-3 ${result.ok ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]' : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]'}`}
            >
                {result.ok ? (
                    <CheckCircle size={16} className="text-[var(--opta-neon-green)]" />
                ) : (
                    <XCircle size={16} className="text-[var(--opta-neon-red)]" />
                )}
                <span
                    className={`text-xs font-mono uppercase tracking-widest font-bold ${result.ok ? 'text-[var(--opta-neon-green)]' : 'text-[var(--opta-neon-red)]'}`}
                >
                    {result.title}
                </span>
                {result.durationMs != null && (
                    <span className="ml-auto text-[10px] font-mono text-text-muted tracking-widest">
                        {result.durationMs} ms
                    </span>
                )}
            </div>

            <div className="p-4 space-y-3">
                {result.requiresApproval && !approved && (
                    <div className="flex items-center gap-2 text-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10 p-2 rounded text-[10px] font-mono uppercase tracking-widest border border-[var(--opta-neon-amber)]/20">
                        <AlertCircle size={12} />
                        <span>
                            Block rule triggered. Enable pre-approval and execute again.
                        </span>
                    </div>
                )}

                {result.payload !== undefined && (
                    <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[rgba(168,85,247,0.8)] mb-2">
                            Payload Output
                        </p>
                        <pre className="text-[10px] font-mono bg-[#020204] border border-[rgba(168,85,247,0.15)] p-4 rounded-lg overflow-auto max-h-96 text-primary whitespace-pre-wrap shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] leading-relaxed">
                            {JSON.stringify(result.payload, null, 2)}
                        </pre>
                    </div>
                )}

                {result.error && (
                    <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--opta-neon-red)] mb-2">
                            Error Trace
                        </p>
                        <p className="text-xs font-mono text-[var(--opta-neon-red)] bg-[#020204] p-3 rounded-lg border border-[var(--opta-neon-red)]/20">
                            {result.error}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function SkillsPage() {
    const { isConnected } = useConnection()

    const {
        skills,
        isLoading: skillsLoading,
        refresh: refreshSkills,
    } = useSkills(true)

    const {
        tools: mcpTools,
        isLoading: mcpToolsLoading,
        refresh: refreshMcpTools,
    } = useMcpTools()

    const {
        prompts: mcpPrompts,
        isLoading: mcpPromptsLoading,
        refresh: refreshMcpPrompts,
    } = useMcpPrompts()

    const {
        resources: mcpResources,
        isLoading: mcpResourcesLoading,
        refresh: refreshMcpResources,
    } = useMcpResources()

    const {
        capabilities: mcpCapabilities,
        isLoading: mcpCapabilitiesLoading,
        refresh: refreshMcpCapabilities,
    } = useMcpCapabilities()

    const [activeTab, setActiveTab] = useState<MainTab>('skills')
    const [mcpView, setMcpView] = useState<McpView>('tools')

    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
    const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)
    const [selectedPrompt, setSelectedPrompt] = useState<MCPPrompt | null>(null)
    const [selectedResource, setSelectedResource] = useState<MCPResource | null>(null)

    const [toolArgsJson, setToolArgsJson] = useState('{}')
    const [promptArgsJson, setPromptArgsJson] = useState('{}')
    const [resourceUri, setResourceUri] = useState('')

    const [approved, setApproved] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [result, setResult] = useState<ActionResult | null>(null)
    const [execError, setExecError] = useState<string | null>(null)
    const [argsNotice, setArgsNotice] = useState<string | null>(null)

    const mcpCounts = {
        tools: mcpTools.length,
        prompts: mcpPrompts.length,
        resources: mcpResources.length,
        capabilities: Object.keys(mcpCapabilities).length,
    }

    const currentCount =
        activeTab === 'skills' ? skills.length : mcpCounts[mcpView]

    const isLoading =
        activeTab === 'skills'
            ? skillsLoading
            : mcpView === 'tools'
                ? mcpToolsLoading
                : mcpView === 'prompts'
                    ? mcpPromptsLoading
                    : mcpView === 'resources'
                        ? mcpResourcesLoading
                        : mcpCapabilitiesLoading

    function clearFeedback() {
        setResult(null)
        setExecError(null)
        setArgsNotice(null)
    }

    function refreshActiveView() {
        if (activeTab === 'skills') {
            void refreshSkills()
            return
        }

        if (mcpView === 'tools') {
            void refreshMcpTools()
            return
        }
        if (mcpView === 'prompts') {
            void refreshMcpPrompts()
            return
        }
        if (mcpView === 'resources') {
            void refreshMcpResources()
            return
        }
        void refreshMcpCapabilities()
    }

    async function handleSkillExecute() {
        if (!selectedSkill) return

        const parsed = parseArgumentsInput(toolArgsJson)
        setArgsNotice(parsed.notice)
        setExecuting(true)
        setResult(null)
        setExecError(null)

        try {
            const response = await executeSkill(
                selectedSkill.qualified_name,
                parsed.payload,
                approved
            )
            setResult({
                title: 'Skill execution response',
                ok: response.ok,
                payload: response.output,
                error: response.error,
                durationMs: response.duration_ms,
                requiresApproval: response.requires_approval,
            })
        } catch (error) {
            setExecError((error as Error).message)
        } finally {
            setExecuting(false)
        }
    }

    async function handleMcpToolCall() {
        if (!selectedTool) return

        const parsed = parseArgumentsInput(toolArgsJson)
        setArgsNotice(parsed.notice)
        setExecuting(true)
        setResult(null)
        setExecError(null)

        try {
            const response = await callMcpTool(selectedTool.name, parsed.payload, approved)
            setResult({
                title: 'MCP tool call response',
                ok: response.ok,
                payload: response.output,
                error: response.error,
                durationMs: response.duration_ms,
                requiresApproval: response.requires_approval,
            })
        } catch (error) {
            setExecError((error as Error).message)
        } finally {
            setExecuting(false)
        }
    }

    async function handlePromptGet() {
        if (!selectedPrompt) return

        const parsed = parsePromptArguments(promptArgsJson)
        setArgsNotice(parsed.notice)
        setExecuting(true)
        setResult(null)
        setExecError(null)

        try {
            const response = await getMcpPrompt(selectedPrompt.name, parsed.args)
            setResult({
                title: 'MCP prompt render response',
                ok: response.ok,
                payload: response.messages,
                error: response.error,
            })
        } catch (error) {
            setExecError((error as Error).message)
        } finally {
            setExecuting(false)
        }
    }

    async function handleResourceRead() {
        const uri = resourceUri.trim() || selectedResource?.uri || ''
        if (!uri) {
            setExecError('Resource URI is required')
            return
        }

        setArgsNotice(null)
        setExecuting(true)
        setResult(null)
        setExecError(null)

        try {
            const response = await readMcpResource(uri)
            setResult({
                title: 'MCP resource read response',
                ok: response.ok,
                payload: response.contents,
                error: response.error,
            })
        } catch (error) {
            setExecError((error as Error).message)
        } finally {
            setExecuting(false)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Skills & MCP"
                subtitle="Skill registry, MCP browser, and execution playground"
                icon={Layers}
            />

            <div className="flex h-[calc(100vh-120px)] hud-fade-in p-6 pt-0">
                <div className="flex w-full config-panel p-0 overflow-hidden">
                    <div className="w-80 flex-shrink-0 border-r border-[rgba(168,85,247,0.2)] bg-[var(--opta-void)]/40 flex flex-col relative z-10 backdrop-blur-md">
                        <div className="flex border-b border-[rgba(168,85,247,0.2)]">
                            {(['skills', 'mcp'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab)
                                        clearFeedback()
                                        if (tab === 'skills') {
                                            setSelectedTool(null)
                                            setSelectedPrompt(null)
                                            setSelectedResource(null)
                                        } else {
                                            setSelectedSkill(null)
                                        }
                                    }}
                                    className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/10 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)]' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'}`}
                                >
                                    {tab === 'skills'
                                        ? `Opta Skills (${skills.length})`
                                        : `MCP Surface (${mcpTools.length + mcpPrompts.length + mcpResources.length})`}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'mcp' && (
                            <div className="grid grid-cols-2 border-b border-[rgba(168,85,247,0.1)]">
                                {([
                                    ['tools', 'Tools'],
                                    ['prompts', 'Prompts'],
                                    ['resources', 'Resources'],
                                    ['capabilities', 'Capabilities'],
                                ] as const).map(([view, label]) => (
                                    <button
                                        key={view}
                                        onClick={() => {
                                            setMcpView(view)
                                            clearFeedback()
                                        }}
                                        className={`px-2 py-2 text-[10px] font-mono uppercase tracking-widest transition-all border-r border-[rgba(168,85,247,0.08)] last:border-r-0 ${mcpView === view ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'}`}
                                    >
                                        {label} ({mcpCounts[view]})
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)]/30">
                            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                                {currentCount} Available
                            </span>
                            <button
                                onClick={refreshActiveView}
                                className="p-1.5 rounded-full text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Refresh current view"
                            >
                                <RefreshCw size={12} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 relative">
                            {!isConnected && (
                                <div className="flex items-center gap-3 text-[var(--opta-neon-amber)] text-xs p-3 rounded-lg border border-[var(--opta-neon-amber)]/20 bg-[var(--opta-neon-amber)]/5 mb-3">
                                    <AlertCircle size={14} />
                                    <span className="font-mono uppercase tracking-widest text-[10px]">
                                        Connect to LMX
                                    </span>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-muted">
                                    <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                                    <span className="text-[10px] font-mono uppercase tracking-widest">
                                        Scanning registry...
                                    </span>
                                </div>
                            ) : activeTab === 'skills' ? (
                                skills.map((skill) => (
                                    <SkillRow
                                        key={skill.qualified_name}
                                        skill={skill}
                                        onSelect={() => {
                                            setSelectedSkill(skill)
                                            setToolArgsJson('{}')
                                            clearFeedback()
                                        }}
                                    />
                                ))
                            ) : mcpView === 'tools' ? (
                                mcpTools.map((tool, idx) => (
                                    <button
                                        key={`${tool.name}-${idx}`}
                                        onClick={() => {
                                            setSelectedTool(tool)
                                            setToolArgsJson('{}')
                                            clearFeedback()
                                        }}
                                        className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all mb-2 group"
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Wrench size={12} className="text-primary/70" />
                                            <p className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate">
                                                {tool.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-text-muted line-clamp-2 font-mono uppercase tracking-wide opacity-80">
                                            {tool.description}
                                        </p>
                                    </button>
                                ))
                            ) : mcpView === 'prompts' ? (
                                mcpPrompts.map((prompt) => (
                                    <button
                                        key={prompt.name}
                                        onClick={() => {
                                            setSelectedPrompt(prompt)
                                            setPromptArgsJson('{}')
                                            clearFeedback()
                                        }}
                                        className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all mb-2 group"
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <MessageSquareText size={12} className="text-primary/70" />
                                            <p className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate">
                                                {prompt.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-text-muted line-clamp-2 font-mono uppercase tracking-wide opacity-80">
                                            {prompt.description}
                                        </p>
                                    </button>
                                ))
                            ) : mcpView === 'resources' ? (
                                mcpResources.map((resource) => (
                                    <button
                                        key={`${resource.uri}-${resource.name}`}
                                        onClick={() => {
                                            setSelectedResource(resource)
                                            setResourceUri(resource.uri)
                                            clearFeedback()
                                        }}
                                        className="w-full text-left p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)] hover:border-primary/50 hover:bg-white/5 transition-all mb-2 group"
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Database size={12} className="text-primary/70" />
                                            <p className="text-xs font-mono text-text-primary group-hover:text-primary transition-colors truncate">
                                                {resource.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-text-muted line-clamp-2 font-mono opacity-80 break-all">
                                            {resource.uri}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <div className="space-y-2">
                                    {Object.entries(mcpCapabilities).map(([name, value]) => (
                                        <div
                                            key={name}
                                            className="p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)]"
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Server size={12} className="text-primary/70" />
                                                <p className="text-xs font-mono text-text-primary truncate">
                                                    {name}
                                                </p>
                                            </div>
                                            <p className="text-[10px] text-text-muted font-mono opacity-80">
                                                {JSON.stringify(value)}
                                            </p>
                                        </div>
                                    ))}
                                    {Object.keys(mcpCapabilities).length === 0 && (
                                        <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest p-3 rounded-lg border border-[rgba(168,85,247,0.1)] bg-[var(--opta-elevated)]/50">
                                            No capabilities reported.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 relative bg-[#020204]">
                        <div
                            className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1]"
                            style={{
                                backgroundImage:
                                    'linear-gradient(rgba(168,85,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,1) 1px, transparent 1px)',
                                backgroundSize: '40px 40px',
                            }}
                        ></div>

                        <div className="relative z-[2] h-full">
                            {activeTab === 'skills' && !selectedSkill ? (
                                <div className="h-full flex items-center justify-center text-text-muted">
                                    <div className="text-center">
                                        <Layers
                                            size={32}
                                            className="mx-auto mb-4 text-primary/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                        />
                                        <p className="text-[10px] font-mono tracking-widest uppercase">
                                            Select a skill to execute
                                        </p>
                                    </div>
                                </div>
                            ) : activeTab === 'mcp' && mcpView === 'tools' && !selectedTool ? (
                                <div className="h-full flex items-center justify-center text-text-muted">
                                    <div className="text-center">
                                        <Wrench
                                            size={32}
                                            className="mx-auto mb-4 text-primary/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                        />
                                        <p className="text-[10px] font-mono tracking-widest uppercase">
                                            Select an MCP tool to call
                                        </p>
                                    </div>
                                </div>
                            ) : activeTab === 'mcp' && mcpView === 'prompts' && !selectedPrompt ? (
                                <div className="h-full flex items-center justify-center text-text-muted">
                                    <div className="text-center">
                                        <MessageSquareText
                                            size={32}
                                            className="mx-auto mb-4 text-primary/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                        />
                                        <p className="text-[10px] font-mono tracking-widest uppercase">
                                            Select an MCP prompt to render
                                        </p>
                                    </div>
                                </div>
                            ) : activeTab === 'mcp' && mcpView === 'resources' && !selectedResource ? (
                                <div className="h-full flex items-center justify-center text-text-muted">
                                    <div className="text-center">
                                        <Database
                                            size={32}
                                            className="mx-auto mb-4 text-primary/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                        />
                                        <p className="text-[10px] font-mono tracking-widest uppercase">
                                            Select an MCP resource to read
                                        </p>
                                    </div>
                                </div>
                            ) : activeTab === 'mcp' && mcpView === 'capabilities' ? (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="pb-4 border-b border-[rgba(168,85,247,0.3)]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-[var(--opta-neon-green)] shadow-[0_0_8px_var(--opta-neon-green)] animate-pulse"></div>
                                            <h2 className="text-lg font-mono font-bold text-primary tracking-wide">
                                                MCP capabilities
                                            </h2>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed font-mono opacity-80">
                                            Current server declaration for MCP primitives and list-change notifications.
                                        </p>
                                    </div>

                                    <div>
                                        <pre className="text-[10px] font-mono bg-[#020204] border border-[rgba(168,85,247,0.15)] p-4 rounded-lg overflow-auto max-h-96 text-primary whitespace-pre-wrap shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] leading-relaxed">
                                            {JSON.stringify(mcpCapabilities, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="pb-4 border-b border-[rgba(168,85,247,0.3)]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-[var(--opta-neon-green)] shadow-[0_0_8px_var(--opta-neon-green)] animate-pulse"></div>
                                            <h2 className="text-lg font-mono font-bold text-primary tracking-wide">
                                                {activeTab === 'skills'
                                                    ? selectedSkill?.qualified_name
                                                    : mcpView === 'tools'
                                                        ? selectedTool?.name
                                                        : mcpView === 'prompts'
                                                            ? selectedPrompt?.name
                                                            : selectedResource?.name}
                                            </h2>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed font-mono opacity-80">
                                            {activeTab === 'skills'
                                                ? selectedSkill?.description
                                                : mcpView === 'tools'
                                                    ? selectedTool?.description
                                                    : mcpView === 'prompts'
                                                        ? selectedPrompt?.description
                                                        : selectedResource?.description}
                                        </p>
                                    </div>

                                    {(activeTab === 'skills'
                                        || (activeTab === 'mcp' && mcpView === 'tools')) && (
                                        <>
                                            <div>
                                                <label className="config-label mb-2 flex justify-between items-center">
                                                    <span>Arguments Payload (JSON)</span>
                                                    <span className="text-[10px] text-text-muted opacity-50">
                                                        Object preferred, raw string tolerated
                                                    </span>
                                                </label>
                                                <textarea
                                                    className="holographic-input w-full font-mono text-xs leading-relaxed"
                                                    rows={8}
                                                    value={toolArgsJson}
                                                    onChange={(event) => setToolArgsJson(event.target.value)}
                                                    disabled={executing}
                                                    spellCheck={false}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-[var(--opta-elevated)]/50 border border-[rgba(168,85,247,0.2)] rounded-xl relative overflow-hidden">
                                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary"></div>
                                                <label className="flex items-center gap-3 cursor-pointer select-none ml-2">
                                                    <div className="relative flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={approved}
                                                            onChange={(event) => setApproved(event.target.checked)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="w-4 h-4 rounded border border-text-muted peer-checked:border-primary peer-checked:bg-primary transition-colors flex items-center justify-center">
                                                            <CheckCircle
                                                                size={10}
                                                                className="text-white opacity-0 peer-checked:opacity-100"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-mono font-bold tracking-wide text-text-primary">
                                                            Pre-Approve Action
                                                        </span>
                                                        <span className="block text-[10px] font-mono uppercase tracking-widest text-text-muted mt-0.5">
                                                            Bypass safety prompt
                                                        </span>
                                                    </div>
                                                </label>
                                                <button
                                                    onClick={
                                                        activeTab === 'skills'
                                                            ? handleSkillExecute
                                                            : handleMcpToolCall
                                                    }
                                                    disabled={!isConnected || executing}
                                                    className="holographic-btn flex items-center gap-2 h-10 px-6 disabled:opacity-50"
                                                >
                                                    {executing ? (
                                                        <>
                                                            <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                                            Transmitting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={14} />
                                                            Send Execution
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'mcp' && mcpView === 'prompts' && (
                                        <>
                                            <div className="p-3 rounded-lg border border-[rgba(168,85,247,0.2)] bg-[var(--opta-elevated)]/40">
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
                                                    Prompt arguments
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedPrompt?.arguments ?? []).length > 0 ? (
                                                        (selectedPrompt?.arguments ?? []).map((arg) => (
                                                            <span
                                                                key={arg.name}
                                                                className={`text-[10px] font-mono px-2 py-1 rounded border ${arg.required ? 'border-[var(--opta-neon-amber)]/40 text-[var(--opta-neon-amber)]' : 'border-[rgba(168,85,247,0.25)] text-text-muted'}`}
                                                            >
                                                                {arg.name}
                                                                {arg.required ? ' (required)' : ''}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-text-muted">
                                                            No declared arguments
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="config-label mb-2 flex justify-between items-center">
                                                    <span>Prompt Arguments (JSON)</span>
                                                </label>
                                                <textarea
                                                    className="holographic-input w-full font-mono text-xs leading-relaxed"
                                                    rows={8}
                                                    value={promptArgsJson}
                                                    onChange={(event) => setPromptArgsJson(event.target.value)}
                                                    disabled={executing}
                                                    spellCheck={false}
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handlePromptGet}
                                                    disabled={!isConnected || executing}
                                                    className="holographic-btn flex items-center gap-2 h-10 px-6 disabled:opacity-50"
                                                >
                                                    {executing ? (
                                                        <>
                                                            <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                                            Rendering...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={14} />
                                                            Render Prompt
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'mcp' && mcpView === 'resources' && (
                                        <>
                                            <div>
                                                <label className="config-label mb-2 flex justify-between items-center">
                                                    <span>Resource URI</span>
                                                    <span className="text-[10px] text-text-muted opacity-50">
                                                        Override URI if needed
                                                    </span>
                                                </label>
                                                <input
                                                    className="holographic-input w-full font-mono text-xs"
                                                    value={resourceUri}
                                                    onChange={(event) => setResourceUri(event.target.value)}
                                                    disabled={executing}
                                                    spellCheck={false}
                                                />
                                            </div>

                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handleResourceRead}
                                                    disabled={!isConnected || executing}
                                                    className="holographic-btn flex items-center gap-2 h-10 px-6 disabled:opacity-50"
                                                >
                                                    {executing ? (
                                                        <>
                                                            <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                                            Reading...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={14} />
                                                            Read Resource
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {argsNotice && (
                                        <div className="p-3 border-l-2 border-[var(--opta-neon-amber)] bg-[var(--opta-neon-amber)]/10 text-[var(--opta-neon-amber)] flex items-center gap-3 rounded-r-lg">
                                            <AlertCircle size={14} />
                                            <p className="text-xs font-mono tracking-wide">
                                                {argsNotice}
                                            </p>
                                        </div>
                                    )}

                                    {execError && (
                                        <div className="p-3 border-l-2 border-[var(--opta-neon-red)] bg-[var(--opta-neon-red)]/10 text-[var(--opta-neon-red)] flex items-center gap-3 rounded-r-lg">
                                            <AlertCircle size={14} />
                                            <p className="text-xs font-mono tracking-wide">
                                                {execError}
                                            </p>
                                        </div>
                                    )}

                                    {result && (
                                        <ActionResultPanel
                                            result={result}
                                            approved={approved}
                                        />
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
