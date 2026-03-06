'use client'

/**
 * useBridge — exposes bridge relay connection state from the paired-device context.
 *
 * The bridge relay is the cloud-mediated command channel:
 *   External bots → accounts.optalocal.com/api/device-commands/stream
 *   → Daemon (127.0.0.1:9999) → LMX
 *
 * Bridge status is tracked in the PairedDeviceProvider which polls the daemon
 * via the pairing / setup flow.  This hook surfaces a clean, typed view of
 * that state for the Bridge Activity page.
 */

import { usePairedDevice } from '@/lib/paired-device'
import { BRIDGE_REGISTRY, resolveBridgeName } from '@/lib/bridge-registry'

export interface BridgeStatus {
    /** Whether the bridge relay is currently connected. */
    bridgeConnected: boolean
    /**
     * The current bridge / device ID (from the paired session),
     * or null when not paired.
     */
    bridgeId: string | null
    /** Human-readable name resolved from BRIDGE_REGISTRY, or null. */
    bridgeName: string | null
    /**
     * Raw lifecycle status string from the daemon bridge state.
     * One of: 'offline' | 'pairing' | 'connected' | 'degraded' | 'unauthorized'
     */
    bridgeLifecycleStatus: string
    /** True while the pairing session is still loading. */
    isLoading: boolean
    /** Last error reason reported by the bridge, or null. */
    error: string | null
    /** All known bridge entries from the static registry. */
    registry: Record<string, string>
}

/**
 * Returns bridge relay status derived from the paired device context.
 * No network requests are issued — this reads from already-fetched pairing state.
 */
export function useBridge(): BridgeStatus {
    const pairedDevice = usePairedDevice()

    const bridgeLifecycleStatus = pairedDevice.bridgeStatus.status
    const bridgeConnected = bridgeLifecycleStatus === 'connected'

    // The device ID from the paired session serves as the bridge agent identifier.
    const bridgeId = pairedDevice.session?.deviceId ?? null
    const bridgeName = bridgeId ? resolveBridgeName(bridgeId) : null

    // We treat 'pairing' as a loading state; all others are settled.
    const isLoading = bridgeLifecycleStatus === 'pairing'

    return {
        bridgeConnected,
        bridgeId,
        bridgeName,
        bridgeLifecycleStatus,
        isLoading,
        error: pairedDevice.bridgeStatus.reason,
        registry: BRIDGE_REGISTRY,
    }
}
