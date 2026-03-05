/**
 * /connect — Magic-link entry point for Opta Init handoff.
 *
 * Accepts URL params:
 *   ?host=192.168.188.11   — LMX host (LAN IP or hostname)
 *   ?port=1234             — LMX port
 *   ?via=lan|wan           — connection path hint
 *   ?tunnel=<url>          — optional WAN tunnel URL (Cloudflare etc.)
 *
 * Security: this route carries NO sensitive data. The host/port are
 * network-observable anyway. No admin keys are accepted via URL params.
 *
 * When users open this URL from Opta Init:
 *   1. Params are validated (must be sane IP/port values)
 *   2. ConnectAutoSetup hydrates the connection context in the browser
 *   3. If connected, auto-redirects to / with the session live
 *   4. If failed after 12s, shows a recovery UI
 */

import { redirect } from 'next/navigation'
import { ConnectAutoSetup } from '@/components/ConnectAutoSetup'

interface ConnectPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** Validate that a string looks like an IP address or safe hostname */
function isValidHost(h: unknown): h is string {
    if (typeof h !== 'string' || h.length > 253) return false
    // IPv4, IPv6 brackets, or safe hostname (letters, digits, dots, hyphens)
    return /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h)
        || /^\[([0-9a-fA-F:]+)\]$/.test(h)
        || /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(h)
}

/** Validate tunnel URL is https:// */
function isValidTunnelUrl(u: unknown): u is string {
    if (typeof u !== 'string') return false
    try {
        const parsed = new URL(u)
        return parsed.protocol === 'https:'
    } catch {
        return false
    }
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
    const params = await searchParams
    const hostRaw = Array.isArray(params.host) ? params.host[0] : params.host
    const portRaw = Array.isArray(params.port) ? params.port[0] : params.port
    const viaRaw = Array.isArray(params.via) ? params.via[0] : params.via
    const tunnelRaw = Array.isArray(params.tunnel) ? params.tunnel[0] : params.tunnel

    // Validate host
    if (!isValidHost(hostRaw)) {
        redirect('/?connect_error=invalid_host')
    }

    // Validate port
    const port = Number(portRaw)
    if (!portRaw || !Number.isInteger(port) || port < 1 || port > 65535) {
        redirect('/?connect_error=invalid_port')
    }

    const via: 'lan' | 'wan' = viaRaw === 'wan' ? 'wan' : 'lan'
    const tunnelUrl = isValidTunnelUrl(tunnelRaw) ? tunnelRaw : undefined

    return (
        <ConnectAutoSetup
            host={hostRaw}
            port={port}
            via={via}
            tunnelUrl={tunnelUrl}
        />
    )
}
