/**
 * magicLink.ts — builds magic-link URLs for the Opta LMX Dashboard /connect route.
 *
 * These URLs are opened in the system browser via Tauri shell.open(). They
 * carry no secret material — the connection params (host, port, via) are
 * config, not auth. Security is provided by the Supabase SSO cookie already
 * present in the browser from accounts.optalocal.com.
 */

const LMX_DASHBOARD_BASE = 'https://lmx.optalocal.com'

export interface LmxMagicLinkOptions {
    /** LAN host — usually an IP like 192.168.188.11 */
    host: string
    /** LMX port — usually 1234 */
    port: number
    /** Whether to hint that LAN or WAN (tunnel) should be tried first */
    via?: 'lan' | 'wan'
    /** Optional Cloudflare Tunnel HTTPS URL for WAN fallback */
    tunnelUrl?: string
}

/**
 * Build the /connect magic-link URL for lmx.optalocal.com.
 * Opening this URL in a browser that has an active Opta Account session
 * will auto-configure the LMX dashboard and redirect to the main page.
 */
export function buildLmxMagicUrl({
    host,
    port,
    via = 'lan',
    tunnelUrl,
}: LmxMagicLinkOptions): string {
    const params = new URLSearchParams()
    params.set('host', host)
    params.set('port', String(port))
    params.set('via', via)
    if (tunnelUrl) {
        params.set('tunnel', tunnelUrl)
    }
    return `${LMX_DASHBOARD_BASE}/connect?${params.toString()}`
}

/**
 * Default LMX connection values — used when no config has been discovered yet.
 * These match the GEMINI.md default Mono512 host.
 */
export const DEFAULT_LMX_HOST = '192.168.188.11'
export const DEFAULT_LMX_PORT = 1234
