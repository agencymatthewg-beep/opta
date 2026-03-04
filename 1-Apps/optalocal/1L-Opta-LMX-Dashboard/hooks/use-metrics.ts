'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { MetricsSummary } from '@/lib/types'

/** Poll /admin/metrics/json every 3s for live dashboard metrics. */
export function useMetrics() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MetricsSummary>(
        isConnected ? '/admin/metrics/json' : null,
        lmxFetcher,
        { refreshInterval: 3_000 }
    )
    return { metrics: data, error, isLoading, refresh: mutate }
}
