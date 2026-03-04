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

/** Poll /admin/models every 5s — loaded models with stats. */
export function useLoadedModels() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<LoadedModel[]>(
        isConnected ? '/admin/models' : null,
        lmxFetcher,
        { refreshInterval: 5_000 }
    )
    return { models: data, error, isLoading, refresh: mutate }
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
