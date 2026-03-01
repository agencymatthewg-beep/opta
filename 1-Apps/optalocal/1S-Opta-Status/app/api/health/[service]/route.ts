import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 30

// Service definitions: maps service ID → { base URL env var or literal, health path }
const SERVICES: Record<
  string,
  { urlEnv?: string; urlFallback?: string; path: string }
> = {
  lmx: {
    urlEnv: 'OPTA_LMX_TUNNEL_URL',
    path: '/healthz',
  },
  daemon: {
    urlEnv: 'OPTA_DAEMON_TUNNEL_URL',
    path: '/health',
  },
  code: {
    urlFallback: 'https://optalocal.com',
    path: '/',
  },
  local: {
    urlFallback: 'https://optalocal.com',
    urlEnv: 'OPTA_LOCAL_URL',
    path: '/api/health',
  },
  init: {
    urlFallback: 'https://init.optalocal.com',
    path: '/',
  },
  accounts: {
    urlEnv: 'OPTA_ACCOUNTS_URL',
    urlFallback: 'https://accounts.optalocal.com',
    path: '/api/health/supabase',
  },
  help: {
    urlFallback: 'https://help.optalocal.com',
    path: '/',
  },
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params
  const def = SERVICES[service]

  if (!def) {
    return NextResponse.json(
      { status: 'offline', error: `Unknown service: ${service}` },
      { status: 404 }
    )
  }

  // Resolve base URL from env var or fallback
  const baseUrl = def.urlEnv
    ? (process.env[def.urlEnv] ?? def.urlFallback)
    : def.urlFallback

  if (!baseUrl) {
    return NextResponse.json(
      { status: 'unconfigured', error: `${def.urlEnv} is not set` },
      { status: 200 }
    )
  }

  const url = `${baseUrl.replace(/\/$/, '')}${def.path}`

  try {
    const start = Date.now()
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const latency = Date.now() - start

    if (!response.ok) {
      return NextResponse.json({ status: 'degraded', latency }, { status: 200 })
    }

    // Try to parse JSON response; non-JSON (e.g. HTML 200 for init) is fine
    let data: Record<string, unknown> = {}
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        data = (await response.json()) as Record<string, unknown>
      } catch {
        // Malformed JSON — still consider online
      }
    }

    return NextResponse.json({ status: 'online', latency, ...data }, { status: 200 })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'TimeoutError'
          ? 'Request timed out'
          : err.message
        : 'Unknown error'

    return NextResponse.json({ status: 'offline', error: message }, { status: 200 })
  }
}
