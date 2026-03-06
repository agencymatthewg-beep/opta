'use client'

import { AlertCircle, Braces, Loader2, Play, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useLoadedModels, useOpenAIModels } from '@/hooks/use-models'
import { lmxPost } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    AnthropicMessagesRequest,
    AnthropicMessagesResponse,
    LegacyCompletionRequest,
    LegacyCompletionResponse,
    RerankRequest,
    RerankResponse,
    ResponsesRequest,
    ResponsesResponse,
} from '@/lib/types'

type ConsoleTab = 'responses' | 'completions' | 'messages' | 'rerank'

interface StreamEvent {
    event: string
    data: string
}

async function runStreamingRequest(path: string, payload: unknown): Promise<StreamEvent[]> {
    const { getAdminKey, getInferenceKey, getLmxUrl } = await import('@/lib/api')

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    const inferenceKey = getInferenceKey()
    const adminKey = getAdminKey()
    if (inferenceKey && path.startsWith('/v1')) {
        headers.Authorization = `Bearer ${inferenceKey}`
    } else if (adminKey && path.startsWith('/v1')) {
        headers['X-Admin-Key'] = adminKey
    }

    const response = await fetch(`${getLmxUrl()}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Request failed (${response.status}): ${body || response.statusText}`)
    }
    if (!response.body) {
        throw new Error('Streaming response body is empty.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'
    let currentData: string[] = []
    const events: StreamEvent[] = []

    const flushEvent = () => {
        if (currentData.length === 0) return
        events.push({
            event: currentEvent,
            data: currentData.join('\n'),
        })
        currentEvent = 'message'
        currentData = []
    }

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''

        for (const line of lines) {
            if (!line.trim()) {
                flushEvent()
                continue
            }
            if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim() || 'message'
                continue
            }
            if (line.startsWith('data:')) {
                currentData.push(line.slice(5).trim())
            }
        }
    }

    if (buffer.trim()) {
        const trailing = buffer.trim()
        if (trailing.startsWith('data:')) {
            currentData.push(trailing.slice(5).trim())
        } else {
            currentData.push(trailing)
        }
    }
    flushEvent()
    return events
}

export default function ConsolePage() {
    const { isConnected } = useConnection()
    const { models: loadedModels } = useLoadedModels()
    const { models: openAiModels } = useOpenAIModels()

    const modelOptions = useMemo(() => {
        const openAiIds = openAiModels?.map((model) => model.id) ?? []
        const loadedIds = loadedModels?.map((model) => model.model_id) ?? []
        return Array.from(new Set([...openAiIds, ...loadedIds])).sort((a, b) => a.localeCompare(b))
    }, [loadedModels, openAiModels])

    const [activeTab, setActiveTab] = useState<ConsoleTab>('responses')
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [jsonOutput, setJsonOutput] = useState<unknown>(null)
    const [streamOutput, setStreamOutput] = useState<StreamEvent[]>([])

    // Responses tab
    const [responsesModel, setResponsesModel] = useState('auto')
    const [responsesInput, setResponsesInput] = useState('Explain why strict typing improves reliability in production systems.')
    const [responsesTemperature, setResponsesTemperature] = useState(0.3)
    const [responsesMaxTokens, setResponsesMaxTokens] = useState(512)
    const [responsesStream, setResponsesStream] = useState(false)

    // Completions tab
    const [completionsModel, setCompletionsModel] = useState('auto')
    const [completionsPrompt, setCompletionsPrompt] = useState('Write a concise changelog entry for adding model hot-reload support.')
    const [completionsTemperature, setCompletionsTemperature] = useState(0.6)
    const [completionsMaxTokens, setCompletionsMaxTokens] = useState(256)
    const [completionsN, setCompletionsN] = useState(1)
    const [completionsStream, setCompletionsStream] = useState(false)

    // Messages tab
    const [messagesModel, setMessagesModel] = useState('auto')
    const [messagesSystem, setMessagesSystem] = useState('You are a pragmatic assistant that answers with precise technical language.')
    const [messagesUser, setMessagesUser] = useState('Summarize the key tradeoffs of speculative decoding in 5 bullet points.')
    const [messagesTemperature, setMessagesTemperature] = useState(0.4)
    const [messagesMaxTokens, setMessagesMaxTokens] = useState(512)
    const [messagesStream, setMessagesStream] = useState(false)

    // Rerank tab
    const [rerankModel, setRerankModel] = useState('rerank')
    const [rerankQuery, setRerankQuery] = useState('How do I reduce cold-start latency in local inference?')
    const [rerankTopN, setRerankTopN] = useState(3)
    const [rerankDocuments, setRerankDocuments] = useState(
        [
            'Speculative preloading can keep frequently used models warm.',
            'Increasing max_tokens reduces prompt-processing latency.',
            'A predictor can preload likely next models based on transition history.',
            'Disabling batching always improves throughput.',
        ].join('\n')
    )

    function clearOutput() {
        setError(null)
        setJsonOutput(null)
        setStreamOutput([])
    }

    async function handleRun() {
        if (!isConnected || running) return
        setRunning(true)
        clearOutput()

        try {
            if (activeTab === 'responses') {
                const payload: ResponsesRequest = {
                    model: responsesModel,
                    input: responsesInput.trim(),
                    temperature: responsesTemperature,
                    max_tokens: responsesMaxTokens,
                    stream: responsesStream,
                }
                if (responsesStream) {
                    const events = await runStreamingRequest('/v1/responses', payload)
                    setStreamOutput(events)
                } else {
                    const response = await lmxPost<ResponsesResponse>('/v1/responses', payload)
                    setJsonOutput(response)
                }
            }

            if (activeTab === 'completions') {
                const payload: LegacyCompletionRequest = {
                    model: completionsModel,
                    prompt: completionsPrompt,
                    temperature: completionsTemperature,
                    max_tokens: completionsMaxTokens,
                    n: completionsN,
                    stream: completionsStream,
                }
                if (completionsStream) {
                    const events = await runStreamingRequest('/v1/completions', payload)
                    setStreamOutput(events)
                } else {
                    const response = await lmxPost<LegacyCompletionResponse>('/v1/completions', payload)
                    setJsonOutput(response)
                }
            }

            if (activeTab === 'messages') {
                const payload: AnthropicMessagesRequest = {
                    model: messagesModel,
                    system: messagesSystem.trim() || undefined,
                    messages: [{ role: 'user', content: messagesUser.trim() }],
                    temperature: messagesTemperature,
                    max_tokens: messagesMaxTokens,
                    stream: messagesStream,
                }
                if (messagesStream) {
                    const events = await runStreamingRequest('/v1/messages', payload)
                    setStreamOutput(events)
                } else {
                    const response = await lmxPost<AnthropicMessagesResponse>('/v1/messages', payload)
                    setJsonOutput(response)
                }
            }

            if (activeTab === 'rerank') {
                const docs = rerankDocuments
                    .split('\n')
                    .map((doc) => doc.trim())
                    .filter(Boolean)
                const payload: RerankRequest = {
                    model: rerankModel.trim(),
                    query: rerankQuery.trim(),
                    documents: docs,
                    top_n: rerankTopN > 0 ? rerankTopN : undefined,
                }
                const response = await lmxPost<RerankResponse>('/v1/rerank', payload)
                setJsonOutput(response)
            }
        } catch (runError) {
            setError((runError as Error).message)
        } finally {
            setRunning(false)
        }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="API Console"
                subtitle="Interactive parity console for Responses, Completions, Messages, and Rerank APIs"
                icon={Braces}
                action={
                    <button
                        onClick={clearOutput}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title="Clear output"
                    >
                        <RefreshCw size={14} />
                    </button>
                }
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to use the API console.</span>
                    </div>
                )}

                {error && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-red)]">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono break-all">{error}</span>
                    </div>
                )}

                <div className="config-panel">
                    <div className="flex gap-2 mb-5 flex-wrap">
                        {(['responses', 'completions', 'messages', 'rerank'] as ConsoleTab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-widest transition-colors ${
                                    activeTab === tab
                                        ? 'bg-primary text-white'
                                        : 'bg-[var(--opta-elevated)] text-text-muted hover:text-text-secondary'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'responses' && (
                        <div className="space-y-4">
                            <div>
                                <p className="config-label">Model</p>
                                <select
                                    className="holographic-input"
                                    value={responsesModel}
                                    onChange={(event) => setResponsesModel(event.target.value)}
                                >
                                    <option value="auto">auto</option>
                                    {modelOptions.map((id) => (
                                        <option key={`resp-${id}`} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="config-label">Input</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={5}
                                    value={responsesInput}
                                    onChange={(event) => setResponsesInput(event.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <p className="config-label">Temperature</p>
                                    <input
                                        type="number"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        className="holographic-input"
                                        value={responsesTemperature}
                                        onChange={(event) => setResponsesTemperature(Number(event.target.value))}
                                    />
                                </div>
                                <div>
                                    <p className="config-label">Max Tokens</p>
                                    <input
                                        type="number"
                                        min={1}
                                        max={8192}
                                        className="holographic-input"
                                        value={responsesMaxTokens}
                                        onChange={(event) => setResponsesMaxTokens(Number(event.target.value))}
                                    />
                                </div>
                                <label className="flex items-end gap-2 text-xs font-mono text-text-muted pb-2">
                                    <input
                                        type="checkbox"
                                        checked={responsesStream}
                                        onChange={(event) => setResponsesStream(event.target.checked)}
                                    />
                                    stream (SSE)
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'completions' && (
                        <div className="space-y-4">
                            <div>
                                <p className="config-label">Model</p>
                                <select
                                    className="holographic-input"
                                    value={completionsModel}
                                    onChange={(event) => setCompletionsModel(event.target.value)}
                                >
                                    <option value="auto">auto</option>
                                    {modelOptions.map((id) => (
                                        <option key={`cmpl-${id}`} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="config-label">Prompt</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={5}
                                    value={completionsPrompt}
                                    onChange={(event) => setCompletionsPrompt(event.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <p className="config-label">Temperature</p>
                                    <input
                                        type="number"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        className="holographic-input"
                                        value={completionsTemperature}
                                        onChange={(event) => setCompletionsTemperature(Number(event.target.value))}
                                    />
                                </div>
                                <div>
                                    <p className="config-label">Max Tokens</p>
                                    <input
                                        type="number"
                                        min={1}
                                        max={8192}
                                        className="holographic-input"
                                        value={completionsMaxTokens}
                                        onChange={(event) => setCompletionsMaxTokens(Number(event.target.value))}
                                    />
                                </div>
                                <div>
                                    <p className="config-label">n</p>
                                    <input
                                        type="number"
                                        min={1}
                                        max={8}
                                        className="holographic-input"
                                        value={completionsN}
                                        onChange={(event) => setCompletionsN(Number(event.target.value))}
                                    />
                                </div>
                                <label className="flex items-end gap-2 text-xs font-mono text-text-muted pb-2">
                                    <input
                                        type="checkbox"
                                        checked={completionsStream}
                                        onChange={(event) => setCompletionsStream(event.target.checked)}
                                    />
                                    stream (SSE)
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'messages' && (
                        <div className="space-y-4">
                            <div>
                                <p className="config-label">Model</p>
                                <select
                                    className="holographic-input"
                                    value={messagesModel}
                                    onChange={(event) => setMessagesModel(event.target.value)}
                                >
                                    <option value="auto">auto</option>
                                    {modelOptions.map((id) => (
                                        <option key={`msg-${id}`} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="config-label">System Prompt (optional)</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={3}
                                    value={messagesSystem}
                                    onChange={(event) => setMessagesSystem(event.target.value)}
                                />
                            </div>
                            <div>
                                <p className="config-label">User Message</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={4}
                                    value={messagesUser}
                                    onChange={(event) => setMessagesUser(event.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <p className="config-label">Temperature</p>
                                    <input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        className="holographic-input"
                                        value={messagesTemperature}
                                        onChange={(event) => setMessagesTemperature(Number(event.target.value))}
                                    />
                                </div>
                                <div>
                                    <p className="config-label">Max Tokens</p>
                                    <input
                                        type="number"
                                        min={1}
                                        max={8192}
                                        className="holographic-input"
                                        value={messagesMaxTokens}
                                        onChange={(event) => setMessagesMaxTokens(Number(event.target.value))}
                                    />
                                </div>
                                <label className="flex items-end gap-2 text-xs font-mono text-text-muted pb-2">
                                    <input
                                        type="checkbox"
                                        checked={messagesStream}
                                        onChange={(event) => setMessagesStream(event.target.checked)}
                                    />
                                    stream (SSE)
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rerank' && (
                        <div className="space-y-4">
                            <div>
                                <p className="config-label">Model</p>
                                <input
                                    className="holographic-input"
                                    value={rerankModel}
                                    onChange={(event) => setRerankModel(event.target.value)}
                                />
                            </div>
                            <div>
                                <p className="config-label">Query</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={3}
                                    value={rerankQuery}
                                    onChange={(event) => setRerankQuery(event.target.value)}
                                />
                            </div>
                            <div>
                                <p className="config-label">Documents (one per line)</p>
                                <textarea
                                    className="holographic-input resize-none"
                                    rows={8}
                                    value={rerankDocuments}
                                    onChange={(event) => setRerankDocuments(event.target.value)}
                                />
                            </div>
                            <div>
                                <p className="config-label">Top N</p>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    className="holographic-input"
                                    value={rerankTopN}
                                    onChange={(event) => setRerankTopN(Number(event.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-5">
                        <button
                            onClick={handleRun}
                            disabled={!isConnected || running}
                            className="holographic-btn flex items-center gap-2"
                        >
                            {running ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    Running…
                                </>
                            ) : (
                                <>
                                    <Play size={12} />
                                    Run Request
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="config-panel">
                    <div className="config-title">Output</div>
                    {streamOutput.length > 0 ? (
                        <div className="space-y-2 max-h-[560px] overflow-auto">
                            {streamOutput.map((event, idx) => (
                                <div
                                    key={`${event.event}-${idx}`}
                                    className="rounded border border-[rgba(168,85,247,0.15)] p-3"
                                >
                                    <p className="text-[10px] uppercase tracking-widest font-mono text-primary mb-1">
                                        {event.event}
                                    </p>
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-text-secondary">
                                        {event.data}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <pre className="text-xs font-mono overflow-auto max-h-[560px] whitespace-pre-wrap break-words">
                            {JSON.stringify(jsonOutput ?? {}, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
