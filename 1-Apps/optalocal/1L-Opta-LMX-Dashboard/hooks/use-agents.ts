'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

export type AgentRunEventType =
    | 'run.update'
    | 'run.completed'
    | 'run.error'
    | 'stream.open'
    | 'stream.done'
    | 'stream.error'
    | 'message'

export interface AgentRunEvent {
    id: string
    type: AgentRunEventType
    timestamp: number
    data: unknown
}

export interface UseAgentRunEventsOptions {
    enabled?: boolean
    maxEvents?: number
}

/**
 * Stream SSE lifecycle events for a single run from /v1/agents/runs/{id}/events.
 */
export function useAgentRunEvents(
    runId: string | null,
    opts?: UseAgentRunEventsOptions
) {
    const { isConnected, url, adminKey } = useConnection()
    const enabled = opts?.enabled ?? true
    const maxEvents = opts?.maxEvents ?? 250

    const [events, setEvents] = useState<AgentRunEvent[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const didCloseRef = useRef(false)

    const clear = useCallback(() => {
        setEvents([])
        setError(null)
    }, [])

    useEffect(() => {
        clear()
        setIsStreaming(false)
    }, [clear, runId])

    useEffect(() => {
        if (!enabled || !isConnected || !runId) return

        const baseUrl = url.replace(/\/+$/, '')
        let streamUrl = `${baseUrl}/v1/agents/runs/${encodeURIComponent(runId)}/events`
        if (adminKey) {
            const sep = streamUrl.includes('?') ? '&' : '?'
            streamUrl += `${sep}admin_key=${encodeURIComponent(adminKey)}`
        }

        didCloseRef.current = false

        const pushEvent = (type: AgentRunEventType, data: unknown) => {
            const nextEvent: AgentRunEvent = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                timestamp: Date.now(),
                data,
            }
            setEvents(prev => {
                const next = [...prev, nextEvent]
                if (next.length <= maxEvents) return next
                return next.slice(next.length - maxEvents)
            })
        }

        const parseData = (raw: string): unknown => {
            try {
                return JSON.parse(raw)
            } catch {
                return raw
            }
        }

        const es = new EventSource(streamUrl)

        const onNamedEvent =
            (type: Extract<AgentRunEventType, 'run.update' | 'run.completed' | 'run.error'>) =>
                (ev: Event) => {
                    const msg = ev as MessageEvent<string>
                    pushEvent(type, parseData(msg.data))
                    if (type === 'run.completed' || type === 'run.error') {
                        setIsStreaming(false)
                    }
                }

        es.onopen = () => {
            setError(null)
            setIsStreaming(true)
            pushEvent('stream.open', { run_id: runId })
        }

        es.onerror = () => {
            if (didCloseRef.current) return
            setIsStreaming(false)
            setError('Run event stream disconnected.')
            pushEvent('stream.error', { run_id: runId })
        }

        es.onmessage = (ev: MessageEvent<string>) => {
            const data = parseData(ev.data)
            if (typeof data === 'string' && data.trim() === '[DONE]') {
                setIsStreaming(false)
                pushEvent('stream.done', { run_id: runId })
                es.close()
                return
            }
            pushEvent('message', data)
        }

        es.addEventListener('run.update', onNamedEvent('run.update'))
        es.addEventListener('run.completed', onNamedEvent('run.completed'))
        es.addEventListener('run.error', onNamedEvent('run.error'))

        return () => {
            didCloseRef.current = true
            setIsStreaming(false)
            es.close()
        }
    }, [adminKey, enabled, isConnected, maxEvents, runId, url])

    return {
        events,
        isStreaming,
        error,
        clear,
    }
}
