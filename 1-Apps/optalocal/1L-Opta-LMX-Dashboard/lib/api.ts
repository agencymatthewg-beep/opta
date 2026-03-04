/**
 * Opta LMX API client helpers.
 *
 * All requests target the LMX backend API. The base URL defaults to the
 * standard LAN endpoint (Mono512 Mac Studio) and can be overridden via
 * the NEXT_PUBLIC_LMX_API_URL environment variable.
 */

export const LMX_API_URL =
    process.env.NEXT_PUBLIC_LMX_API_URL ?? 'http://192.168.188.11:1234'

/** Fetch wrapper with timeout and error handling. */
export async function lmxFetch<T>(
    path: string,
    options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
    const { timeoutMs = 10_000, ...fetchOpts } = options ?? {}

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(`${LMX_API_URL}${path}`, {
            ...fetchOpts,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...fetchOpts.headers,
            },
        })

        if (!res.ok) {
            throw new Error(`LMX API ${res.status}: ${res.statusText}`)
        }

        return (await res.json()) as T
    } finally {
        clearTimeout(timer)
    }
}

/** SWR-compatible fetcher. */
export const lmxFetcher = <T>(path: string) => lmxFetch<T>(path)
