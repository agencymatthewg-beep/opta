'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    SessionFull,
    SessionListResponse,
    SessionSummary,
} from '@/lib/types'

export interface UseSessionsOptions {
    limit?: number
    offset?: number
    model?: string
    tag?: string
    since?: string
}

/** Poll /admin/sessions with pagination and filters. */
export function useSessions(opts?: UseSessionsOptions) {
    const { isConnected } = useConnection()
    const params = new URLSearchParams()
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.offset) params.set('offset', String(opts.offset))
    if (opts?.model) params.set('model', opts.model)
    if (opts?.tag) params.set('tag', opts.tag)
    if (opts?.since) params.set('since', opts.since)
    const qs = params.toString()
    const key = isConnected ? `/admin/sessions${qs ? `?${qs}` : ''}` : null
    const { data, error, isLoading, mutate } = useSWR<SessionListResponse>(
        key,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        sessions: data?.sessions ?? [],
        total: data?.total ?? 0,
        error,
        isLoading,
        refresh: mutate,
    }
}

/** Search sessions by query string. */
export function useSessionSearch(query: string | null, limit?: number) {
    const { isConnected } = useConnection()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (limit) params.set('limit', String(limit))
    const key =
        isConnected && query
            ? `/admin/sessions/search?${params.toString()}`
            : null
    const { data, error, isLoading, mutate } = useSWR<SessionSummary[]>(
        key,
        lmxFetcher
    )
    return { results: data, error, isLoading, refresh: mutate }
}

/** Fetch a full session by ID. */
export function useSession(sessionId: string | null) {
    const { isConnected } = useConnection()
    const key =
        isConnected && sessionId
            ? `/admin/sessions/${encodeURIComponent(sessionId)}`
            : null
    const { data, error, isLoading, mutate } = useSWR<SessionFull>(
        key,
        lmxFetcher
    )
    return { session: data, error, isLoading, refresh: mutate }
}
