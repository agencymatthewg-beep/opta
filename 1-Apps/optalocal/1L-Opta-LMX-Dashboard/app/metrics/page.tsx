'use client'

import { Activity } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { HudRing } from '@/components/HudRing'
import { useConnection } from '@/lib/connection'
import { useMetrics } from '@/hooks/use-metrics'

export default function MetricsPage() {
    const { isConnected } = useConnection()
    const { metrics, isLoading } = useMetrics()

    return (
        <DashboardLayout>
            <PageHeader
                title="Metrics"
                subtitle="Inference telemetry and performance percentiles"
                icon={Activity}
            />

            <div className="px-8 py-6 hud-fade-in">
                {!isConnected || !metrics ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Activity size={32} className="text-text-muted mb-4 opacity-30" />
                        <p className="text-sm text-text-muted">{isConnected ? 'Loading metrics…' : 'Connect to LMX to view metrics.'}</p>
                    </div>
                ) : (
                    <>
                        {/* HUD Rings */}
                        <div className="flex flex-wrap justify-center gap-12 xl:gap-20 py-10 mb-8">
                            <HudRing value={String(metrics.total_requests)} label="Total Requests" />
                            <HudRing value={metrics.avg_tokens_per_second.toFixed(1)} label="Avg tok/s" reverse />
                            <HudRing value={metrics.p95_tokens_per_second.toFixed(1)} label="P95 tok/s" variant="cyan" />
                            <HudRing value={`${(metrics.error_rate * 100).toFixed(1)}`} unit="%" label="Error Rate" variant="amber" />
                        </div>

                        {/* Detail Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="config-panel">
                                <div className="config-title">Throughput</div>
                                <div className="space-y-4">
                                    <div><p className="config-label">Avg Tokens/sec</p><p className="font-mono text-lg">{metrics.avg_tokens_per_second.toFixed(2)}</p></div>
                                    <div><p className="config-label">P50 Tokens/sec</p><p className="font-mono">{metrics.p50_tokens_per_second.toFixed(2)}</p></div>
                                    <div><p className="config-label">P95 Tokens/sec</p><p className="font-mono">{metrics.p95_tokens_per_second.toFixed(2)}</p></div>
                                    <div><p className="config-label">P99 Tokens/sec</p><p className="font-mono">{metrics.p99_tokens_per_second.toFixed(2)}</p></div>
                                </div>
                            </div>
                            <div className="config-panel">
                                <div className="config-title">Latency &amp; Volume</div>
                                <div className="space-y-4">
                                    <div><p className="config-label">Avg TTFT</p><p className="font-mono text-lg">{metrics.avg_time_to_first_token_ms.toFixed(0)} <span className="text-xs text-text-muted">ms</span></p></div>
                                    <div><p className="config-label">Avg Total Time</p><p className="font-mono">{metrics.avg_total_time_ms.toFixed(0)} <span className="text-xs text-text-muted">ms</span></p></div>
                                    <div><p className="config-label">Total Tokens Generated</p><p className="font-mono">{metrics.total_tokens_generated.toLocaleString()}</p></div>
                                    <div><p className="config-label">Prompt Tokens</p><p className="font-mono">{metrics.total_prompt_tokens.toLocaleString()}</p></div>
                                    <div><p className="config-label">Requests/min</p><p className="font-mono">{metrics.requests_per_minute.toFixed(1)}</p></div>
                                    <div><p className="config-label">Errors</p><p className="font-mono">{metrics.error_count}</p></div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
