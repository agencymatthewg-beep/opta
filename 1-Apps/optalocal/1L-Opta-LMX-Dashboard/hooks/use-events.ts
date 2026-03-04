'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSWRConfig } from 'swr'

import { useConnection } from '@/lib/connection'
import { eventBus } from '@/lib/events'
import type { ServerEvent, ServerEventType } from '@/lib/types'

/**
 * Subscribe to specific SSE event types from the LMX event bus.
 * Calls the handler whenever a matching event fires.
 */
export function useEvent(
    type: ServerEventType | '*',
    handler: (event: ServerEvent) => void
) {
    const handlerRef = useRef(handler)
    handlerRef.current = handler

    const { isConnected } = useConnection()

    useEffect(() => {
        if (!isConnected) return

        const fn = (event: ServerEvent) => handlerRef.current(event)
        eventBus.subscribe(type, fn)
        return () => eventBus.unsubscribe(type, fn)
    }, [isConnected, type])
}

/**
 * Subscribe to multiple event types at once.
 */
export function useEvents(
    types: ServerEventType[],
    handler: (event: ServerEvent) => void
) {
    const handlerRef = useRef(handler)
    handlerRef.current = handler

    const { isConnected } = useConnection()

    useEffect(() => {
        if (!isConnected) return

        const fn = (event: ServerEvent) => handlerRef.current(event)
        for (const type of types) {
            eventBus.subscribe(type, fn)
        }
        return () => {
            for (const type of types) {
                eventBus.unsubscribe(type, fn)
            }
        }
    }, [isConnected, types])
}

/**
 * Automatically start/stop the event bus based on connection status.
 * Should be called once, high in the component tree.
 */
export function useEventBusLifecycle() {
    const { isConnected } = useConnection()

    useEffect(() => {
        if (isConnected) {
            eventBus.start()
        } else {
            eventBus.stop()
        }
        return () => eventBus.stop()
    }, [isConnected])
}

// ── SWR Cache Invalidation Keys ─────────────────────────────────────────────

const MODEL_KEYS = ['/admin/models', '/admin/models/available', '/v1/models']
const STATUS_KEYS = ['/admin/status', '/admin/memory', '/admin/health']
const DOWNLOAD_KEYS = ['/admin/models/downloads']

/**
 * Auto-invalidate SWR caches when relevant events fire.
 * Should be called once, high in the component tree.
 */
export function useEventBasedRefresh() {
    const { mutate } = useSWRConfig()
    const { isConnected } = useConnection()

    const invalidateKeys = useCallback(
        (keys: string[]) => {
            for (const key of keys) {
                mutate(key)
            }
        },
        [mutate]
    )

    useEffect(() => {
        if (!isConnected) return

        const handler = (event: ServerEvent) => {
            switch (event.event_type) {
                case 'model_loaded':
                case 'model_unloaded':
                    invalidateKeys([...MODEL_KEYS, ...STATUS_KEYS])
                    break
                case 'download_progress':
                case 'download_completed':
                case 'download_failed':
                    invalidateKeys(DOWNLOAD_KEYS)
                    if (event.event_type === 'download_completed') {
                        invalidateKeys(MODEL_KEYS)
                    }
                    break
                case 'memory_warning':
                    invalidateKeys(STATUS_KEYS)
                    break
                case 'config_reloaded':
                    invalidateKeys([...STATUS_KEYS, '/admin/presets'])
                    break
                case 'request_completed':
                    invalidateKeys(['/admin/metrics/json'])
                    break
            }
        }

        eventBus.subscribe('*', handler)
        return () => eventBus.unsubscribe('*', handler)
    }, [isConnected, invalidateKeys])
}
