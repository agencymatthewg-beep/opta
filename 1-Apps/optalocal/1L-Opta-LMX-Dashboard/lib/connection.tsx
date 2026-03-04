'use client'

/**
 * Connection manager — React context + provider for LMX connection state.
 *
 * Polls /healthz on interval, tracks connection status, and stores
 * connection settings (URL + admin key) in localStorage.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import type { ReactNode } from 'react'

import {
    checkConnection,
    getLmxUrl,
    setAdminKey as setApiAdminKey,
    setInferenceKey,
    setLmxUrl,
} from './api'
import type { ConnectionStatus } from './types'

// ── Storage Keys ────────────────────────────────────────────────────────────

const STORAGE_KEY_URL = 'opta-lmx-url'
const STORAGE_KEY_ADMIN_KEY = 'opta-lmx-admin-key'
const STORAGE_KEY_INFERENCE_KEY = 'opta-lmx-inference-key'

// ── Context ─────────────────────────────────────────────────────────────────

export interface ConnectionContextValue {
    status: ConnectionStatus
    version: string | null
    url: string
    adminKey: string | null
    error: string | null
    isConnected: boolean
    setUrl: (url: string) => void
    setAdminKey: (key: string | null) => void
    setInferenceApiKey: (key: string | null) => void
    reconnect: () => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_CONNECTED = 5_000
const POLL_INTERVAL_DISCONNECTED = 3_000
const MAX_BACKOFF = 30_000

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<ConnectionStatus>('connecting')
    const [version, setVersion] = useState<string | null>(null)
    const [url, _setUrl] = useState<string>(() => {
        if (typeof window === 'undefined') return getLmxUrl()
        return localStorage.getItem(STORAGE_KEY_URL) || getLmxUrl()
    })
    const [adminKey, _setAdminKey] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(STORAGE_KEY_ADMIN_KEY)
    })
    const [error, setError] = useState<string | null>(null)

    const failCountRef = useRef(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync stored URL/keys to the API module on mount
    useEffect(() => {
        setLmxUrl(url)
        if (adminKey) setApiAdminKey(adminKey)
        const storedInferenceKey =
            typeof window !== 'undefined'
                ? localStorage.getItem(STORAGE_KEY_INFERENCE_KEY)
                : null
        if (storedInferenceKey) setInferenceKey(storedInferenceKey)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const doCheck = useCallback(async () => {
        const result = await checkConnection()

        if (result.connected) {
            failCountRef.current = 0
            setStatus('connected')
            setVersion(result.version)
            setError(null)
        } else {
            failCountRef.current += 1
            setStatus(failCountRef.current === 1 ? 'connecting' : 'disconnected')
            setVersion(null)
            setError(result.error)
        }
    }, [])

    // Poll loop
    useEffect(() => {
        let cancelled = false

        const schedule = () => {
            if (cancelled) return
            const interval =
                status === 'connected'
                    ? POLL_INTERVAL_CONNECTED
                    : Math.min(
                        POLL_INTERVAL_DISCONNECTED *
                        Math.pow(1.5, failCountRef.current),
                        MAX_BACKOFF
                    )
            timerRef.current = setTimeout(async () => {
                if (cancelled) return
                await doCheck()
                schedule()
            }, interval)
        }

        // Initial check
        doCheck().then(schedule)

        return () => {
            cancelled = true
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [doCheck, status])

    const setUrl = useCallback((newUrl: string) => {
        const cleaned = newUrl.replace(/\/+$/, '')
        _setUrl(cleaned)
        setLmxUrl(cleaned)
        localStorage.setItem(STORAGE_KEY_URL, cleaned)
        failCountRef.current = 0
        setStatus('connecting')
    }, [])

    const setAdminKey = useCallback((key: string | null) => {
        _setAdminKey(key)
        setApiAdminKey(key)
        if (key) {
            localStorage.setItem(STORAGE_KEY_ADMIN_KEY, key)
        } else {
            localStorage.removeItem(STORAGE_KEY_ADMIN_KEY)
        }
    }, [])

    const setInferenceApiKey = useCallback((key: string | null) => {
        setInferenceKey(key)
        if (key) {
            localStorage.setItem(STORAGE_KEY_INFERENCE_KEY, key)
        } else {
            localStorage.removeItem(STORAGE_KEY_INFERENCE_KEY)
        }
    }, [])

    const reconnect = useCallback(() => {
        failCountRef.current = 0
        setStatus('connecting')
        setError(null)
        doCheck()
    }, [doCheck])

    const value = useMemo<ConnectionContextValue>(
        () => ({
            status,
            version,
            url,
            adminKey,
            error,
            isConnected: status === 'connected',
            setUrl,
            setAdminKey,
            setInferenceApiKey,
            reconnect,
        }),
        [
            status,
            version,
            url,
            adminKey,
            error,
            setUrl,
            setAdminKey,
            setInferenceApiKey,
            reconnect,
        ]
    )

    return (
        <ConnectionContext.Provider value= { value } >
        { children }
        </ConnectionContext.Provider>
    )
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useConnection(): ConnectionContextValue {
    const ctx = useContext(ConnectionContext)
    if (!ctx) {
        throw new Error('useConnection must be used within ConnectionProvider')
    }
    return ctx
}
