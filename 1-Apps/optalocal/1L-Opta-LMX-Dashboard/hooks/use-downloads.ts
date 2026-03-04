'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { DownloadListResponse, DownloadProgress } from '@/lib/types'

/**
 * Poll /admin/models/downloads.
 * 3s when downloads are active, 30s when idle.
 */
export function useDownloads() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<DownloadListResponse>(
        isConnected ? '/admin/models/downloads?include_inactive=true' : null,
        lmxFetcher,
        {
            refreshInterval: (latestData) => {
                const active = latestData?.downloads?.some(
                    (d) =>
                        d.status === 'pending' || d.status === 'downloading'
                )
                return active ? 3_000 : 30_000
            },
        }
    )
    return {
        downloads: data?.downloads ?? [],
        activeDownloads:
            data?.downloads?.filter(
                (d) =>
                    d.status === 'pending' || d.status === 'downloading'
            ) ?? [],
        error,
        isLoading,
        refresh: mutate,
    }
}

/** Poll download progress for a specific download (1s while active). */
export function useDownloadProgress(downloadId: string | null) {
    const { isConnected } = useConnection()
    const key =
        isConnected && downloadId
            ? `/admin/models/download/${downloadId}/progress`
            : null
    const { data, error, isLoading, mutate } = useSWR<DownloadProgress>(
        key,
        lmxFetcher,
        {
            refreshInterval: (latestData) => {
                if (!latestData) return 2_000
                if (
                    latestData.status === 'completed' ||
                    latestData.status === 'failed' ||
                    latestData.status === 'cancelled'
                ) {
                    return 0 // Stop polling
                }
                return 1_000
            },
        }
    )
    return { progress: data, error, isLoading, refresh: mutate }
}
