'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    AutotuneRecordResponse,
    AvailableModel,
    LoadedModel,
    ModelCompatibilityResponse,
    ModelPerformanceResponse,
    ModelsListResponse,
} from '@/lib/types'

type LoadedModelPayload =
    | LoadedModel[]
    | {
        loaded?: Array<Record<string, unknown>>
    }

function normalizeLoadedModels(payload?: LoadedModelPayload): LoadedModel[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload

    const rows = Array.isArray(payload.loaded) ? payload.loaded : []
    return rows.map((row) => {
        const statsRaw = (row.stats as Record<string, unknown> | undefined) ?? {}
        const totalRequests =
            typeof row.request_count === 'number'
                ? row.request_count
                : typeof statsRaw.total_requests === 'number'
                    ? statsRaw.total_requests
                    : 0
        const lastUsedAt =
            typeof row.last_used_at === 'number'
                ? row.last_used_at
                : typeof statsRaw.last_used_at === 'number'
                    ? statsRaw.last_used_at
                    : null

        return {
            model_id: String(row.model_id ?? row.id ?? ''),
            backend: String(row.backend ?? row.backend_type ?? 'unknown'),
            memory_used_gb:
                typeof row.memory_used_gb === 'number'
                    ? row.memory_used_gb
                    : typeof row.memory_gb === 'number'
                        ? row.memory_gb
                        : 0,
            loaded_at: typeof row.loaded_at === 'number' ? row.loaded_at : 0,
            keep_alive_sec:
                typeof row.keep_alive_sec === 'number'
                    ? row.keep_alive_sec
                    : null,
            performance_overrides:
                (row.performance_overrides as Record<string, unknown> | null | undefined)
                ?? (row.performance as Record<string, unknown> | null | undefined)
                ?? null,
            stats: {
                total_requests: totalRequests,
                total_tokens_generated:
                    typeof statsRaw.total_tokens_generated === 'number'
                        ? statsRaw.total_tokens_generated
                        : 0,
                avg_tokens_per_second:
                    typeof statsRaw.avg_tokens_per_second === 'number'
                        ? statsRaw.avg_tokens_per_second
                        : 0,
                last_used_at: lastUsedAt,
            },
        }
    })
}

/** Poll /admin/models every 5s — loaded models with stats. */
export function useLoadedModels() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<LoadedModelPayload>(
        isConnected ? '/admin/models' : null,
        lmxFetcher,
        { refreshInterval: 5_000 }
    )
    return { models: normalizeLoadedModels(data), error, isLoading, refresh: mutate }
}

/** Poll /admin/models/available every 30s — models on disk. */
export function useAvailableModels() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<AvailableModel[]>(
        isConnected ? '/admin/models/available' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return { available: data, error, isLoading, refresh: mutate }
}

/** Poll /v1/models every 10s — OpenAI-format model list. */
export function useOpenAIModels() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<ModelsListResponse>(
        isConnected ? '/v1/models' : null,
        lmxFetcher,
        { refreshInterval: 10_000 }
    )
    return { models: data?.data, error, isLoading, refresh: mutate }
}

/** On-demand model performance config. */
export function useModelPerformance(modelId: string | null) {
    const { isConnected } = useConnection()
    const key =
        isConnected && modelId
            ? `/admin/models/${encodeURIComponent(modelId)}/performance`
            : null
    const { data, error, isLoading, mutate } =
        useSWR<ModelPerformanceResponse>(key, lmxFetcher)
    return { performance: data, error, isLoading, refresh: mutate }
}

/** On-demand autotune profile for a model. */
export function useModelAutotune(modelId: string | null) {
    const { isConnected } = useConnection()
    const key =
        isConnected && modelId
            ? `/admin/models/${encodeURIComponent(modelId)}/autotune`
            : null
    const { data, error, isLoading, mutate } =
        useSWR<AutotuneRecordResponse>(key, lmxFetcher)
    return { autotune: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/models/compatibility every 30s. */
export function useModelCompatibility(opts?: {
    modelId?: string
    backend?: string
}) {
    const { isConnected } = useConnection()
    const params = new URLSearchParams()
    if (opts?.modelId) params.set('model_id', opts.modelId)
    if (opts?.backend) params.set('backend', opts.backend)
    const qs = params.toString()
    const key = isConnected
        ? `/admin/models/compatibility${qs ? `?${qs}` : ''}`
        : null
    const { data, error, isLoading, mutate } =
        useSWR<ModelCompatibilityResponse>(key, lmxFetcher, {
            refreshInterval: 30_000,
        })
    return { compatibility: data, error, isLoading, refresh: mutate }
}
