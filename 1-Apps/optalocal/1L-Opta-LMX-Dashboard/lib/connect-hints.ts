export type ConnectVia = 'lan' | 'wan'

export interface ConnectRoute {
    targetUrl: string
    routeLabel: string
    routeWarning: string | null
}

export function buildDirectUrl(host: string, port: number): string {
    return `http://${host}:${port}`
}

export function resolveConnectRoute(params: {
    host: string
    port: number
    via: ConnectVia
    tunnelUrl?: string
}): ConnectRoute {
    const { host, port, via, tunnelUrl } = params
    const direct = buildDirectUrl(host, port)

    if (via === 'wan') {
        if (tunnelUrl) {
            return {
                targetUrl: tunnelUrl.replace(/\/+$/, ''),
                routeLabel: 'Via Cloudflare Tunnel',
                routeWarning: null,
            }
        }

        return {
            targetUrl: direct,
            routeLabel: 'Via Direct Host Fallback',
            routeWarning:
                'Cloud tunnel URL missing. Trying direct host instead.',
        }
    }

    return {
        targetUrl: direct,
        routeLabel: 'Via Local Network',
        routeWarning: null,
    }
}

export function shouldCompleteConnect(params: {
    initialized: boolean
    status: 'connected' | 'disconnected' | 'connecting' | 'error'
    currentUrl: string
    targetUrl: string
}): boolean {
    const { initialized, status, currentUrl, targetUrl } = params
    return initialized && status === 'connected' && currentUrl === targetUrl
}

export function getConnectErrorMessage(code: string | null): string | null {
    if (!code) return null

    switch (code) {
        case 'invalid_host':
            return 'Magic link failed: invalid host parameter.'
        case 'invalid_port':
            return 'Magic link failed: invalid port parameter.'
        default:
            return 'Connection bootstrap failed. Check your LMX endpoint and try again.'
    }
}
