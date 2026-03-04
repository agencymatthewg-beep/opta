'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    AdminStatusResponse,
    DeviceIdentityResponse,
    MemoryStatusResponse,
    StackStatusResponse,
} from '@/lib/types'

/** Poll /admin/status every 5s. */
export function useStatus() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<AdminStatusResponse>(
        isConnected ? '/admin/status' : null,
        lmxFetcher,
        { refreshInterval: 5_000 }
    )
    return { status: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/memory every 5s. */
export function useMemory() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MemoryStatusResponse>(
        isConnected ? '/admin/memory' : null,
        lmxFetcher,
        { refreshInterval: 5_000 }
    )
    return { memory: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/device every 60s (rarely changes). */
export function useDevice() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<DeviceIdentityResponse>(
        isConnected ? '/admin/device' : null,
        lmxFetcher,
        { refreshInterval: 60_000 }
    )
    return { device: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/stack every 15s. */
export function useStack() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<StackStatusResponse>(
        isConnected ? '/admin/stack' : null,
        lmxFetcher,
        { refreshInterval: 15_000 }
    )
    return { stack: data, error, isLoading, refresh: mutate }
}
