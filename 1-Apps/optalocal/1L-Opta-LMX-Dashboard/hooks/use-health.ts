'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    AdminHealthResponse,
    HealthzResponse,
    ReadyzResponse,
} from '@/lib/types'

/** Poll /healthz every 5s. */
export function useHealthz() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<HealthzResponse>(
        isConnected ? '/healthz' : null,
        lmxFetcher,
        { refreshInterval: 5_000 }
    )
    return { healthz: data, error, isLoading, refresh: mutate }
}

/** Poll /readyz every 10s. */
export function useReadyz() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<ReadyzResponse>(
        isConnected ? '/readyz' : null,
        lmxFetcher,
        { refreshInterval: 10_000 }
    )
    return { readyz: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/health every 10s. */
export function useAdminHealth() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<AdminHealthResponse>(
        isConnected ? '/admin/health' : null,
        lmxFetcher,
        { refreshInterval: 10_000 }
    )
    return { health: data, error, isLoading, refresh: mutate }
}
