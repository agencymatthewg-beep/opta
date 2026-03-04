'use client'

import { useAdminHealth } from './use-health'
import { useMetrics } from './use-metrics'
import { useLoadedModels } from './use-models'
import { useStatus } from './use-status'

/**
 * Composite hook for the dashboard home page.
 * Composes status, models, metrics, and health into a single view.
 */
export function useDashboard() {
    const { status, isLoading: statusLoading } = useStatus()
    const { models, isLoading: modelsLoading } = useLoadedModels()
    const { metrics, isLoading: metricsLoading } = useMetrics()
    const { health, isLoading: healthLoading } = useAdminHealth()

    return {
        // Summary stats
        loadedModelCount: models?.length ?? 0,
        tokensPerSec: metrics?.avg_tokens_per_second ?? 0,
        memoryUsedGb: status?.memory?.used_gb ?? 0,
        memoryTotalGb: status?.memory?.total_gb ?? 0,
        memoryUsedPercent: status?.memory?.used_percent ?? 0,
        totalRequests: metrics?.total_requests ?? 0,
        uptimeSeconds: status?.uptime_seconds ?? 0,
        inFlightRequests: status?.in_flight_requests ?? 0,

        // Health
        healthStatus: health?.status ?? 'unknown',
        healthReason: health?.reason ?? null,
        version: status?.version ?? null,

        // Raw data (for deeper rendering)
        models: models ?? [],
        metrics,
        health,
        status,

        // Loading state
        isLoading: statusLoading || modelsLoading || metricsLoading || healthLoading,
    }
}
