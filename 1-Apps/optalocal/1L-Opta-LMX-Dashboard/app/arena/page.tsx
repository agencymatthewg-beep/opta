'use client'

import { Bot, AlertCircle, Loader2, Timer, Play } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useLoadedModels, useOpenAIModels } from '@/hooks/use-models'
import { lmxPost } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage } from '@/lib/types'

interface ArenaResult {
    modelId: string
    output: string
    latencyMs: number
    totalTokens: number | null
    error: string | null
}

const DEFAULT_PROMPT = 'Summarize the best strategy to optimize a software system in 5 concise steps.'

async function runCompletion(modelId: string, prompt: string): Promise<ArenaResult> {
    const startedAt = performance.now()

    try {
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
        const payload: ChatCompletionRequest = {
            model: modelId,
            messages,
            stream: false,
            temperature: 0.2,
            max_tokens: 512,
        }

        const response = await lmxPost<ChatCompletionResponse>('/v1/chat/completions', payload)
        const output = response.choices?.[0]?.message?.content?.trim() ?? ''

        return {
            modelId,
            output,
            latencyMs: performance.now() - startedAt,
            totalTokens: response.usage?.total_tokens ?? null,
            error: null,
        }
    } catch (error) {
        return {
            modelId,
            output: '',
            latencyMs: performance.now() - startedAt,
            totalTokens: null,
            error: (error as Error).message,
        }
    }
}

export default function ArenaPage() {
    const { isConnected } = useConnection()
    const { models: openAiModels, error: openAiError, isLoading: openAiLoading } = useOpenAIModels()
    const { models: loadedModels } = useLoadedModels()

    const modelOptions = useMemo(() => {
        const openAiIds = openAiModels?.map((model) => model.id) ?? []
        const loadedIds = loadedModels?.map((model) => model.model_id) ?? []
        return Array.from(new Set([...openAiIds, ...loadedIds])).sort((a, b) => a.localeCompare(b))
    }, [openAiModels, loadedModels])

    const [leftModel, setLeftModel] = useState('auto')
    const [rightModel, setRightModel] = useState('auto')
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
    const [isRunning, setIsRunning] = useState(false)
    const [leftResult, setLeftResult] = useState<ArenaResult | null>(null)
    const [rightResult, setRightResult] = useState<ArenaResult | null>(null)

    const canRun = isConnected && !!prompt.trim() && !!leftModel && !!rightModel && !isRunning

    const latencySummary = useMemo(() => {
        if (!leftResult || !rightResult || leftResult.error || rightResult.error) return null

        const delta = Math.abs(leftResult.latencyMs - rightResult.latencyMs)
        if (delta < 1) {
            return `Latency tie (${leftResult.latencyMs.toFixed(0)} ms each)`
        }

        const faster = leftResult.latencyMs < rightResult.latencyMs ? leftResult.modelId : rightResult.modelId
        return `${faster} is faster by ${delta.toFixed(0)} ms`
    }, [leftResult, rightResult])

    async function handleRun() {
        if (!canRun) return

        setIsRunning(true)
        setLeftResult(null)
        setRightResult(null)

        try {
            const [left, right] = await Promise.all([
                runCompletion(leftModel, prompt.trim()),
                runCompletion(rightModel, prompt.trim()),
            ])

            setLeftResult(left)
            setRightResult(right)
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Arena"
                subtitle="Run side-by-side completion comparisons for two models on the same prompt"
                icon={Bot}
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to compare model outputs.</span>
                    </div>
                )}

                {openAiError && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono">
                            Model list endpoint unavailable: {(openAiError as Error).message}. Loaded models are still usable.
                        </span>
                    </div>
                )}

                <div className="config-panel space-y-5">
                    <div className="config-title">Comparison Setup</div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <p className="config-label">Left Model</p>
                            <select
                                className="holographic-input"
                                value={leftModel}
                                onChange={(event) => setLeftModel(event.target.value)}
                                disabled={!isConnected || isRunning}
                            >
                                <option value="auto">auto</option>
                                {modelOptions.map((modelId) => (
                                    <option key={`left-${modelId}`} value={modelId}>
                                        {modelId}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <p className="config-label">Right Model</p>
                            <select
                                className="holographic-input"
                                value={rightModel}
                                onChange={(event) => setRightModel(event.target.value)}
                                disabled={!isConnected || isRunning}
                            >
                                <option value="auto">auto</option>
                                {modelOptions.map((modelId) => (
                                    <option key={`right-${modelId}`} value={modelId}>
                                        {modelId}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <p className="config-label">Prompt</p>
                        <textarea
                            className="holographic-input resize-none"
                            rows={5}
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            disabled={!isConnected || isRunning}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRun}
                            disabled={!canRun}
                            className="holographic-btn flex items-center gap-2"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" /> Running…
                                </>
                            ) : (
                                <>
                                    <Play size={12} /> Run Comparison
                                </>
                            )}
                        </button>

                        {openAiLoading && (
                            <span className="text-xs text-text-muted font-mono flex items-center gap-1.5">
                                <Loader2 size={11} className="animate-spin" /> Loading model options…
                            </span>
                        )}
                    </div>
                </div>

                {latencySummary && (
                    <div className="config-panel flex items-center gap-3 text-primary">
                        <Timer size={15} />
                        <span className="text-sm font-mono">{latencySummary}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {[leftResult, rightResult].map((result, index) => {
                        const side = index === 0 ? 'Left' : 'Right'
                        const selectedModel = index === 0 ? leftModel : rightModel

                        return (
                            <section key={side} className="config-panel min-h-[420px] flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-mono text-text-primary">{side} Output</p>
                                        <p className="text-xs text-text-muted font-mono">{selectedModel}</p>
                                    </div>
                                    {result && !result.error && (
                                        <div className="text-right text-xs font-mono text-text-muted">
                                            <p>{result.latencyMs.toFixed(0)} ms</p>
                                            <p>{result.totalTokens ?? '—'} tokens</p>
                                        </div>
                                    )}
                                </div>

                                {isRunning && !result ? (
                                    <div className="flex-1 flex items-center justify-center text-sm text-text-muted gap-2">
                                        <Loader2 size={14} className="animate-spin" /> Waiting for completion…
                                    </div>
                                ) : !result ? (
                                    <div className="flex-1 flex items-center justify-center text-sm text-text-muted font-mono text-center px-6">
                                        Run a comparison to inspect output, token usage, and latency.
                                    </div>
                                ) : result.error ? (
                                    <div className="flex-1 flex items-center justify-center text-[var(--opta-neon-red)] text-sm font-mono text-center px-4">
                                        {result.error}
                                    </div>
                                ) : (
                                    <pre className="flex-1 text-sm font-mono text-text-primary whitespace-pre-wrap break-words overflow-y-auto max-h-[540px]">
                                        {result.output || '[empty response]'}
                                    </pre>
                                )}
                            </section>
                        )
                    })}
                </div>
            </div>
        </DashboardLayout>
    )
}
