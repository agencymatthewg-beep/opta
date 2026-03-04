'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { DiagnosticsResponse } from '@/lib/types'

/** Poll /admin/diagnostics every 15s for triage data. */
export function useDiagnostics() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<DiagnosticsResponse>(
        isConnected ? '/admin/diagnostics' : null,
        lmxFetcher,
        { refreshInterval: 15_000 }
    )
    return { diagnostics: data, error, isLoading, refresh: mutate }
}
