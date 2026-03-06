'use client'

import { useCallback, useRef } from 'react'
import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import { mutationPost } from '@/lib/mutations'

export type QuantizeJobStatus =
    | 'pending'
    | 'queued'
    | 'running'
    | 'cancelling'
    | 'completed'
    | 'failed'
    | 'cancelled'

const ACTIVE_STATUSES: QuantizeJobStatus[] = [
    'pending',
    'queued',
    'running',
    'cancelling',
]

const ACTIVE_STATUS_SET = new Set<QuantizeJobStatus>(ACTIVE_STATUSES)

export interface QuantizeJob {
    job_id: string
    source_model: string
    output_path?: string
    bits: number
    group_size?: number
    mode?: string
    status: QuantizeJobStatus | string
    started_at?: number
    updated_at?: number
    completed_at?: number
    cancelled_at?: number
    duration_sec?: number
    output_size_bytes?: number
    output_size_gb?: number
    queue_position?: number | null
    cancel_requested?: boolean
    cancel_requested_at?: number | null
    failure_code?: string | null
    exit_code?: number | null
    signal?: number | null
    worker_pid?: number | null
    error?: string
}

export interface QuantizeJobListResponse {
    jobs: QuantizeJob[]
    count: number
}

export interface QuantizeJobNotFound {
    error: string
    job_id: string
}

export interface StartQuantizeRequest {
    source_model: string
    output_path?: string
    bits?: number
    group_size?: number
    mode?: string
}

export interface StartQuantizeResponse extends QuantizeJob {
    queue_position?: number | null
}

export interface CancelQuantizeResponse {
    job_id: string
    status: string
    reason: 'not_found' | 'cancelled' | 'already_terminal' | 'cancelling' | string
    cancelled: boolean
    cancel_requested: boolean
    cancel_requested_at?: number | null
    failure_code?: string | null
    exit_code?: number | null
    signal?: number | null
}

export function isQuantizeJobActive(status?: string | null): boolean {
    if (!status) return false
    return ACTIVE_STATUS_SET.has(status as QuantizeJobStatus)
}

/** Poll all quantize jobs; faster while jobs are active. */
export function useQuantizeJobs() {
    const { isConnected } = useConnection()
    const hasActiveRef = useRef(false)

    const refreshInterval = useCallback((): number => {
        return hasActiveRef.current ? 3_000 : 15_000
    }, [])

    const { data, error, isLoading, mutate } = useSWR<QuantizeJobListResponse>(
        isConnected ? '/admin/quantize' : null,
        lmxFetcher,
        { refreshInterval }
    )

    const jobs = (data?.jobs ?? [])
        .slice()
        .sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0))

    hasActiveRef.current = jobs.some((job) => isQuantizeJobActive(job.status))

    return {
        jobs,
        total: data?.count ?? jobs.length,
        error,
        isLoading,
        refresh: mutate,
    }
}

/** Poll one quantize job by ID; stops once terminal. */
export function useQuantizeJob(jobId: string | null) {
    const { isConnected } = useConnection()
    const activeRef = useRef(false)

    const refreshInterval = useCallback((): number => {
        return activeRef.current ? 2_000 : 0
    }, [])

    const { data, error, isLoading, mutate } = useSWR<
        QuantizeJob | QuantizeJobNotFound
    >(
        isConnected && jobId
            ? `/admin/quantize/${encodeURIComponent(jobId)}`
            : null,
        lmxFetcher,
        { refreshInterval }
    )

    const missing = data != null && 'error' in data
    const job = data != null && !('error' in data) ? data : null
    activeRef.current = isQuantizeJobActive(job?.status)

    return {
        job,
        missing,
        missingReason: missing ? data.error : null,
        error,
        isLoading,
        refresh: mutate,
    }
}

export async function startQuantizeJob(
    request: StartQuantizeRequest
): Promise<StartQuantizeResponse> {
    return mutationPost<StartQuantizeResponse>('/admin/quantize', request)
}

export async function cancelQuantizeJob(
    jobId: string
): Promise<CancelQuantizeResponse> {
    return mutationPost<CancelQuantizeResponse>(
        `/admin/quantize/${encodeURIComponent(jobId)}/cancel`
    )
}
