'use client'

/**
 * Root providers — wraps the app with SWRConfig and ConnectionProvider.
 */

import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'

import { ConnectionProvider } from './connection'
import { PairedDeviceProvider } from './paired-device'
import { LmxError } from './api'

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                shouldRetryOnError: (err: unknown) => {
                    // Don't retry on auth errors
                    if (err instanceof LmxError && (err.status === 401 || err.status === 403)) {
                        return false
                    }
                    return true
                },
                errorRetryCount: 3,
                errorRetryInterval: 3_000,
                dedupingInterval: 2_000,
            }}
        >
            <PairedDeviceProvider>
                <ConnectionProvider>{children}</ConnectionProvider>
            </PairedDeviceProvider>
        </SWRConfig>
    )
}
