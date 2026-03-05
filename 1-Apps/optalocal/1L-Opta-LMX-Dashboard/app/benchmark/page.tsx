'use client'

import { Terminal, Play, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useBenchmarkResults } from '@/hooks/use-benchmark'
import { useLoadedModels } from '@/hooks/use-models'
import { runBenchmark } from '@/lib/mutations'
import type { BenchmarkRunResponse } from '@/lib/types'

export default function BenchmarkPage() {
    const { isConnected } = useConnection()
    const { models } = useLoadedModels()
    const { results: history, isLoading: historyLoading, refresh: refreshHistory } = useBenchmarkResults()

    const [modelId, setModelId] = useState('')
    const [prompt, setPrompt] = useState('Explain quantum computing in three sentences.')
    const [numOutputTokens, setNumOutputTokens] = useState(256)
    const [runs, setRuns] = useState(3)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<BenchmarkRunResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleRun() {
        if (!modelId) return
        setRunning(true)
        setError(null)
        setResult(null)
        try {
            const res = await runBenchmark({
                model_id: modelId,
                prompt,
                num_output_tokens: numOutputTokens,
                runs,
            })
            setResult(res)
            refreshHistory()
        } catch (e) { setError((e as Error).message) }
        finally { setRunning(false) }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Benchmark"
                subtitle="Run performance benchmarks against loaded models"
                icon={Terminal}
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {/* Config */}
                <div className="config-panel">
                    <div className="config-title">Benchmark Configuration</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="config-label">Model</p>
                            <select className="holographic-input" value={modelId} onChange={e => setModelId(e.target.value)} disabled={!isConnected}>
                                <option value="">Select model…</option>
                                {models?.map(m => (
                                    <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <p className="config-label">Runs</p>
                            <input type="number" className="holographic-input" value={runs} onChange={e => setRuns(Number(e.target.value))} min={1} max={20} />
                        </div>
                        <div>
                            <p className="config-label">Prompt</p>
                            <textarea className="holographic-input resize-none" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} />
                        </div>
                        <div>
                            <p className="config-label">Output Tokens</p>
                            <input type="number" className="holographic-input" value={numOutputTokens} onChange={e => setNumOutputTokens(Number(e.target.value))} min={16} max={8192} />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                        <button onClick={handleRun} disabled={!isConnected || running || !modelId} className="holographic-btn flex items-center gap-2">
                            {running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : <><Play size={12} /> Run Benchmark</>}
                        </button>
                        {error && <span className="text-xs text-[var(--opta-neon-red)] font-mono">{error}</span>}
                    </div>
                </div>

                {/* Result */}
                {result && (
                    <div className="config-panel">
                        <div className="config-title">Results — {result.model_id}</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
                            <div>
                                <p className="config-label">Avg tok/s</p>
                                <p className="font-mono text-2xl">{result.avg_tokens_per_second.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="config-label">Avg TTFT</p>
                                <p className="font-mono text-2xl">{result.avg_time_to_first_token_ms.toFixed(0)} <span className="text-xs text-text-muted">ms</span></p>
                            </div>
                            <div>
                                <p className="config-label">P95 tok/s</p>
                                <p className="font-mono text-2xl">{result.p95_tokens_per_second.toFixed(1)}</p>
                            </div>
                            <div>
                                <p className="config-label">Total Runs</p>
                                <p className="font-mono text-2xl">{result.total_runs}</p>
                            </div>
                        </div>
                        {result.runs.length > 0 && (
                            <div>
                                <p className="config-label mb-2">Per-Run Detail</p>
                                <div className="space-y-1">
                                    {result.runs.map((r) => (
                                        <div key={r.run_index} className="flex items-center justify-between text-xs font-mono text-text-muted py-1 border-b border-[rgba(168,85,247,0.1)] last:border-0">
                                            <span>Run {r.run_index + 1}</span>
                                            <span>{r.tokens_per_second.toFixed(1)} tok/s</span>
                                            <span>TTFT {r.time_to_first_token_ms.toFixed(0)}ms</span>
                                            <span>{r.tokens_generated} tokens</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* History */}
                {history && history.length > 0 && (
                    <div className="config-panel">
                        <div className="config-title">History</div>
                        <div className="space-y-2">
                            {history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(168,85,247,0.15)] last:border-0 text-sm font-mono">
                                    <span className="truncate mr-3">{h.model_id}</span>
                                    <div className="flex items-center gap-4 text-xs text-text-muted">
                                        <span>{h.avg_tokens_per_second.toFixed(1)} tok/s</span>
                                        <span>{h.total_runs} runs</span>
                                        <span>{h.timestamp}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
