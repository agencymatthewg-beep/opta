'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import type { ReactNode } from 'react'
import type { DeviceRuntimeStatus, PairingSession } from '@/lib/types'

const STORAGE_KEY_STATE = 'opta-lmx-paired-state'

type PairingMode = 'paired' | 'direct'

type PersistedState = {
    mode: PairingMode
    session: PairingSession | null
    bridgeToken: string | null
    endpointUrl: string | null
    bridgeStatus: DeviceRuntimeStatus
}

export interface PairedDeviceContextValue extends PersistedState {
    setPairedState: (next: {
        session: PairingSession
        bridgeToken: string | null
        endpointUrl: string | null
        bridgeStatus?: DeviceRuntimeStatus
    }) => void
    setBridgeStatus: (status: DeviceRuntimeStatus) => void
    switchToDirectMode: () => void
    clearPairing: () => void
}

const defaultBridgeStatus: DeviceRuntimeStatus = {
    status: 'offline',
    reason: null,
    lastSeenAt: null,
}

const defaultState: PersistedState = {
    mode: 'paired',
    session: null,
    bridgeToken: null,
    endpointUrl: null,
    bridgeStatus: defaultBridgeStatus,
}

const PairedDeviceContext = createContext<PairedDeviceContextValue | null>(null)

function readStateFromStorage(): PersistedState {
    if (typeof window === 'undefined') return defaultState
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_STATE)
        if (!raw) return defaultState
        const parsed = JSON.parse(raw) as Partial<PersistedState>
        return {
            mode: parsed.mode === 'direct' ? 'direct' : 'paired',
            session: parsed.session ?? null,
            bridgeToken: parsed.bridgeToken ?? null,
            endpointUrl: parsed.endpointUrl ?? null,
            bridgeStatus: parsed.bridgeStatus ?? defaultBridgeStatus,
        }
    } catch {
        return defaultState
    }
}

export function PairedDeviceProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PersistedState>(() => readStateFromStorage())

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state))
    }, [state])

    const setPairedState = useCallback((next: {
        session: PairingSession
        bridgeToken: string | null
        endpointUrl: string | null
        bridgeStatus?: DeviceRuntimeStatus
    }) => {
        setState({
            mode: 'paired',
            session: next.session,
            bridgeToken: next.bridgeToken,
            endpointUrl: next.endpointUrl,
            bridgeStatus: next.bridgeStatus ?? {
                status: 'pairing',
                reason: null,
                lastSeenAt: new Date().toISOString(),
            },
        })
    }, [])

    const setBridgeStatus = useCallback((bridgeStatus: DeviceRuntimeStatus) => {
        setState((prev) => ({ ...prev, bridgeStatus }))
    }, [])

    const switchToDirectMode = useCallback(() => {
        setState((prev) => ({
            ...prev,
            mode: 'direct',
        }))
    }, [])

    const clearPairing = useCallback(() => {
        setState({
            mode: 'paired',
            session: null,
            bridgeToken: null,
            endpointUrl: null,
            bridgeStatus: defaultBridgeStatus,
        })
    }, [])

    const value = useMemo<PairedDeviceContextValue>(
        () => ({
            ...state,
            setPairedState,
            setBridgeStatus,
            switchToDirectMode,
            clearPairing,
        }),
        [state, setPairedState, setBridgeStatus, switchToDirectMode, clearPairing],
    )

    return <PairedDeviceContext.Provider value={value}>{children}</PairedDeviceContext.Provider>
}

export function usePairedDevice(): PairedDeviceContextValue {
    const value = useContext(PairedDeviceContext)
    if (!value) throw new Error('usePairedDevice must be used within PairedDeviceProvider')
    return value
}
