/**
 * Opta LMX API client — fetch wrappers with auth, error handling, SSE, and WS.
 *
 * All requests target the LMX backend API. The base URL defaults to the
 * standard LAN endpoint (Mono512 Mac Studio) and can be overridden via
 * the NEXT_PUBLIC_LMX_API_URL environment variable or runtime config.
 */

import type { LmxApiError } from './types'

// ── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_LMX_URL =
    process.env.NEXT_PUBLIC_LMX_API_URL ?? 'http://192.168.188.11:1234'

let _baseUrl = DEFAULT_LMX_URL
let _adminKey: string | null = null
let _inferenceKey: string | null = null

/** Update the runtime LMX base URL. */
export function setLmxUrl(url: string) {
    _baseUrl = url.replace(/\/+$/, '')
}

/** Get the current LMX base URL. */
export function getLmxUrl(): string {
    return _baseUrl
}

/** Set the admin key for /admin/* endpoints. */
export function setAdminKey(key: string | null) {
    _adminKey = key
}

/** Get the current admin key. */
export function getAdminKey(): string | null {
    return _adminKey
}

/** Set the inference API key for /v1/* endpoints. */
export function setInferenceKey(key: string | null) {
    _inferenceKey = key
}

// ── Error Class ─────────────────────────────────────────────────────────────

export class LmxError extends Error {
    status: number
    code: string | null

    constructor(status: number, message: string, code: string | null = null) {
        super(message)
        this.name = 'LmxError'
        this.status = status
        this.code = code
    }
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function _buildHeaders(
    path: string,
    extra?: HeadersInit
): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    // Admin key for /admin/* routes
    if (_adminKey && path.startsWith('/admin')) {
        headers['X-Admin-Key'] = _adminKey
    }

    // Inference key for /v1/* routes
    if (_inferenceKey && path.startsWith('/v1')) {
        headers['Authorization'] = `Bearer ${_inferenceKey}`
    }

    // Admin key can also auth inference routes
    if (_adminKey && path.startsWith('/v1') && !_inferenceKey) {
        headers['X-Admin-Key'] = _adminKey
    }

    if (extra) {
        const entries =
            extra instanceof Headers
                ? Array.from(extra.entries())
                : Object.entries(extra)
        for (const [k, v] of entries) {
            headers[k] = v as string
        }
    }

    return headers
}

async function _handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let message = `LMX API ${res.status}: ${res.statusText}`
        let code: string | null = null
        try {
            const body = (await res.json()) as LmxApiError
            if (body?.error?.message) {
                message = body.error.message
                code = body.error.code ?? null
            }
        } catch {
            // Non-JSON error body — use status text
        }
        throw new LmxError(res.status, message, code)
    }
    return (await res.json()) as T
}

// ── Fetch Wrappers ──────────────────────────────────────────────────────────

export interface FetchOptions extends Omit<RequestInit, 'headers'> {
    timeoutMs?: number
    headers?: HeadersInit
}

/** GET request to LMX API. */
export async function lmxFetch<T>(
    path: string,
    options?: FetchOptions
): Promise<T> {
    const { timeoutMs = 10_000, headers, ...fetchOpts } = options ?? {}
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(`${_baseUrl}${path}`, {
            ...fetchOpts,
            method: fetchOpts.method ?? 'GET',
            signal: controller.signal,
            headers: _buildHeaders(path, headers),
        })
        return await _handleResponse<T>(res)
    } catch (err) {
        if (err instanceof LmxError) throw err
        if ((err as Error).name === 'AbortError') {
            throw new LmxError(0, 'Request timed out', 'timeout')
        }
        throw new LmxError(0, (err as Error).message, 'network_error')
    } finally {
        clearTimeout(timer)
    }
}

/** POST request to LMX API. */
export async function lmxPost<T>(
    path: string,
    body?: unknown,
    options?: FetchOptions
): Promise<T> {
    return lmxFetch<T>(path, {
        ...options,
        method: 'POST',
        body: body != null ? JSON.stringify(body) : undefined,
    })
}

/** DELETE request to LMX API. */
export async function lmxDelete<T>(
    path: string,
    options?: FetchOptions
): Promise<T> {
    return lmxFetch<T>(path, { ...options, method: 'DELETE' })
}

// ── SWR Fetcher ─────────────────────────────────────────────────────────────

/** SWR-compatible fetcher. */
export const lmxFetcher = <T>(path: string) => lmxFetch<T>(path)

// ── Connection Check ────────────────────────────────────────────────────────

export interface ConnectionCheckResult {
    connected: boolean
    version: string | null
    error: string | null
}

/** Quick connection check via /healthz. */
export async function checkConnection(): Promise<ConnectionCheckResult> {
    try {
        const res = await lmxFetch<{ status: string; version: string }>(
            '/healthz',
            { timeoutMs: 5_000 }
        )
        return {
            connected: res.status === 'ok',
            version: res.version ?? null,
            error: null,
        }
    } catch (err) {
        return {
            connected: false,
            version: null,
            error: err instanceof LmxError ? err.message : 'Connection failed',
        }
    }
}

// ── SSE Helper ──────────────────────────────────────────────────────────────

export interface EventSourceOptions {
    onMessage: (event: { type: string; data: unknown }) => void
    onError?: (error: Event) => void
    onOpen?: () => void
}

/**
 * Create an EventSource connection to an LMX SSE endpoint.
 * Returns a cleanup function.
 */
export function lmxEventSource(
    path: string,
    options: EventSourceOptions
): () => void {
    // EventSource can't send custom headers — pass admin key via query param
    let url = `${_baseUrl}${path}`
    if (_adminKey) {
        const sep = url.includes('?') ? '&' : '?'
        url += `${sep}admin_key=${encodeURIComponent(_adminKey)}`
    }

    const es = new EventSource(url)

    es.onopen = () => options.onOpen?.()
    es.onerror = (ev) => options.onError?.(ev)

    // Listen for all event types
    es.onmessage = (ev) => {
        try {
            const data = JSON.parse(ev.data)
            options.onMessage({ type: 'message', data })
        } catch {
            options.onMessage({ type: 'message', data: ev.data })
        }
    }

    // Named event types from LMX
    const eventTypes = [
        'model_loaded',
        'model_unloaded',
        'download_progress',
        'download_completed',
        'download_failed',
        'request_completed',
        'memory_warning',
        'config_reloaded',
        'heartbeat',
    ]

    for (const type of eventTypes) {
        es.addEventListener(type, (ev) => {
            try {
                const data = JSON.parse((ev as MessageEvent).data)
                options.onMessage({ type, data })
            } catch {
                options.onMessage({
                    type,
                    data: (ev as MessageEvent).data,
                })
            }
        })
    }

    return () => es.close()
}

// ── WebSocket Helper ────────────────────────────────────────────────────────

export interface WebSocketChatOptions {
    onToken: (token: string, requestId: string) => void
    onDone: (
        requestId: string,
        finishReason: string,
        usage: unknown
    ) => void
    onError: (requestId: string, error: string) => void
    onClose?: () => void
    onOpen?: () => void
}

/**
 * Create a WebSocket connection.
 * Returns send/close functions.
 */
export function lmxWebSocket(options: WebSocketChatOptions) {
    const wsUrl = _baseUrl.replace(/^http/, 'ws') + '/ws/chat'
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => options.onOpen?.()
    ws.onclose = () => options.onClose?.()

    ws.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data as string) as {
                type: string
                request_id?: string
                content?: string
                finish_reason?: string
                usage?: unknown
                error?: string
            }
            switch (msg.type) {
                case 'chat.token':
                    options.onToken(
                        msg.content ?? '',
                        msg.request_id ?? ''
                    )
                    break
                case 'chat.done':
                    options.onDone(
                        msg.request_id ?? '',
                        msg.finish_reason ?? 'stop',
                        msg.usage
                    )
                    break
                case 'chat.error':
                    options.onError(
                        msg.request_id ?? '',
                        msg.error ?? 'Unknown error'
                    )
                    break
            }
        } catch {
            // Ignore unparseable messages
        }
    }

    ws.onerror = () => {
        options.onError('', 'WebSocket connection error')
    }

    return {
        send: (data: unknown) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data))
            }
        },
        close: () => ws.close(),
        get readyState() {
            return ws.readyState
        },
    }
}
