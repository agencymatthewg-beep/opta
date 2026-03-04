'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { Preset, PresetListResponse } from '@/lib/types'

/** Poll /admin/presets every 30s. */
export function usePresets() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<PresetListResponse>(
        isConnected ? '/admin/presets' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        presets: data?.presets ?? [],
        total: data?.total ?? 0,
        error,
        isLoading,
        refresh: mutate,
    }
}

/** On-demand fetch of a single preset by name. */
export function usePreset(name: string | null) {
    const { isConnected } = useConnection()
    const key =
        isConnected && name
            ? `/admin/presets/${encodeURIComponent(name)}`
            : null
    const { data, error, isLoading, mutate } = useSWR<Preset>(
        key,
        lmxFetcher
    )
    return { preset: data, error, isLoading, refresh: mutate }
}
