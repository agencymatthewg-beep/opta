'use client'

import { useCallback, useRef } from 'react'
import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { AgentRun, AgentRunListResponse, AgentRunStatus } from '@/lib/types'

const ACTIVE_STATUSES: AgentRunStatus[] = ['queued', 'running']

/**
 * Poll /v1/agents/runs.
 * Polls at 3s when any run is active, 15s otherwise.
 */
export function useAgentRuns(status?: AgentRunStatus) {
    const { isConnected } = useConnection()
    const hasActiveRef = useRef(false)

    const key = isConnected
        ? status
            ? `/v1/agents/runs?status=${status}`
            : '/v1/agents/runs'
        : null

    const refreshInterval = useCallback((): number => {
        return hasActiveRef.current ? 3_000 : 15_000
    }, [])

    const { data, error, isLoading, mutate } = useSWR<AgentRunListResponse>(
        key,
        lmxFetcher,
        { refreshInterval }
    )

    // Keep the ref in sync after each render
    const runs: AgentRun[] = data?.data ?? []
    hasActiveRef.current = runs.some(r => ACTIVE_STATUSES.includes(r.status))

    return {
        runs,
        total: data?.total ?? 0,
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Fetch a single agent run by ID.
 * Auto-polls at 2s while the run is active, stops when terminal.
 */
export function useAgentRun(id: string | null) {
    const { isConnected } = useConnection()
    const isActiveRef = useRef(false)

    const refreshInterval = useCallback((): number => {
        return isActiveRef.current ? 2_000 : 0
    }, [])

    const { data, error, isLoading, mutate } = useSWR<AgentRun>(
        isConnected && id ? `/v1/agents/runs/${id}` : null,
        lmxFetcher,
        { refreshInterval }
    )

    // Keep the ref in sync
    isActiveRef.current = data != null && ACTIVE_STATUSES.includes(data.status)

    return { run: data, error, isLoading, refresh: mutate }
}
