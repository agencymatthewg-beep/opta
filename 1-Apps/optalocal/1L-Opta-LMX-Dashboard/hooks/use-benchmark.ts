'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { BenchmarkRunResponse } from '@/lib/types'

/** Fetch stored benchmark results, optionally filtered by model_id. */
export function useBenchmarkResults(modelId?: string) {
    const { isConnected } = useConnection()
    const params = modelId ? `?model_id=${encodeURIComponent(modelId)}` : ''
    const key = isConnected ? `/admin/benchmark/results${params}` : null
    const { data, error, isLoading, mutate } = useSWR<BenchmarkRunResponse[]>(
        key,
        lmxFetcher
    )
    return { results: data, error, isLoading, refresh: mutate }
}
