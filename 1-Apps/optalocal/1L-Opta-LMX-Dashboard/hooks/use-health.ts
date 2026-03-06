'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    AdminHealthResponse,
    HealthzResponse,
    ReadyzResponse,
} from '@/lib/types'

export interface DiscoveryDocument {
    service?: string
    version?: string
    schema_version?: string
    instance_id?: string
    security_profile?: string
    ready?: boolean
    loaded_models?: string[]
    loaded_model_count?: number
    in_flight_requests?: number
    auth?: {
        admin_key_required?: boolean
        inference_key_required?: boolean
        supabase_jwt_enabled?: boolean
        [key: string]: unknown
    }
    endpoints?: {
        preferred_base_url?: string
        base_urls?: string[]
        openai_base_url?: string
        admin_base_url?: string
        websocket_url?: string
        [key: string]: unknown
    }
    continuity?: {
        event_resume_supported?: boolean
        session_log_api?: string
        [key: string]: unknown
    }
    client_probe_order?: string[]
    [key: string]: unknown
}

export interface HelperDashboardStats {
    url?: string
    model?: string
    healthy?: boolean
    latency_ms?: number
    success_rate?: number
    request_count?: number
    fallback?: boolean
    circuit_state?: string
    [key: string]: unknown
}

export interface HelpersDashboardResponse {
    helpers: Record<string, HelperDashboardStats>
    live_checks?: Record<string, boolean>
    configured_count?: number
    all_healthy?: boolean
}

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

/** Poll /v1/discovery every 30s. */
export function useDiscoveryV1() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<DiscoveryDocument>(
        isConnected ? '/v1/discovery' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return { discovery: data, error, isLoading, refresh: mutate }
}

/** Poll /.well-known/opta-lmx every 30s. */
export function useWellKnownDiscovery() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<DiscoveryDocument>(
        isConnected ? '/.well-known/opta-lmx' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return { discovery: data, error, isLoading, refresh: mutate }
}

/** Poll /admin/helpers every 15s. */
export function useHelpersHealth() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<HelpersDashboardResponse>(
        isConnected ? '/admin/helpers' : null,
        lmxFetcher,
        { refreshInterval: 15_000 }
    )
    return { helpers: data, error, isLoading, refresh: mutate }
}
