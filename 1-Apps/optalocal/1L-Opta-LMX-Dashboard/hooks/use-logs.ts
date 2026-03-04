'use client'

import useSWR from 'swr'

import { lmxAdminFetcher, lmxTextFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { LogFileEntry } from '@/lib/types'

/**
 * Poll /admin/logs/sessions every 30s.
 * Returns a list of session log file entries, most recent first.
 */
export function useSessionLogs() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<LogFileEntry[]>(
        isConnected ? '/admin/logs/sessions' : null,
        lmxAdminFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        logs: data ?? [] as LogFileEntry[],
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Poll /admin/logs/updates every 30s.
 * Returns a list of update log file entries, most recent first.
 */
export function useUpdateLogs() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<LogFileEntry[]>(
        isConnected ? '/admin/logs/updates' : null,
        lmxAdminFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        logs: data ?? [] as LogFileEntry[],
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Fetch the raw text content of a specific session log file. On-demand.
 */
export function useSessionLog(filename: string | null) {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<string>(
        isConnected && filename
            ? `/admin/logs/sessions/${encodeURIComponent(filename)}`
            : null,
        lmxTextFetcher
    )
    return { content: data ?? null, error, isLoading, refresh: mutate }
}

/**
 * Fetch the raw text content of a specific update log file. On-demand.
 */
export function useUpdateLog(filename: string | null) {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<string>(
        isConnected && filename
            ? `/admin/logs/updates/${encodeURIComponent(filename)}`
            : null,
        lmxTextFetcher
    )
    return { content: data ?? null, error, isLoading, refresh: mutate }
}
