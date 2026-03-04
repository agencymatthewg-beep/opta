import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 30

// Service definitions: maps service ID → { base URL env var or literal, health path }
type ServiceDefinition = {
  urlEnv?: string
  urlFallback?: string
  path?: string
  paths?: string[]
}

const SERVICES: Record<
  string,
  ServiceDefinition
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
  admin: {
    urlEnv: 'OPTA_ADMIN_URL',
    urlFallback: 'https://opta-admin.vercel.app',
    path: '/api/health',
  },
  status: {
    urlFallback: 'https://status.optalocal.com',
    path: '/',
  },
  learn: {
    urlFallback: 'https://learn.optalocal.com',
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

  // Resolve base URL from env var (trimmed) or fallback.
  // Trimming avoids subtle failures from newline-contaminated env values.
  const envUrl = def.urlEnv ? process.env[def.urlEnv]?.trim() : undefined
  const baseUrl = envUrl || def.urlFallback?.trim()

  if (!baseUrl) {
    return NextResponse.json(
      { status: 'unconfigured', error: `${def.urlEnv} is not set` },
      { status: 200 }
    )
  }

  const probePaths =
    Array.isArray(def.paths) && def.paths.length > 0
      ? def.paths
      : def.path
        ? [def.path]
        : ['/']
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  let lastFailure:
    | {
        status: 'degraded'
        latency: number
      }
    | {
        status: 'offline'
        error: string
      }
    | null = null

  for (const probePath of probePaths) {
    const url = `${normalizedBaseUrl}${probePath}`

    try {
      const start = Date.now()
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const latency = Date.now() - start

      if (!response.ok) {
        lastFailure = { status: 'degraded', latency }
        continue
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

      const { status: upstreamStatus, ...rest } = data
      return NextResponse.json(
        {
          status: 'online',
          latency,
          ...(typeof upstreamStatus === 'string' ? { upstreamStatus } : {}),
          ...rest,
        },
        { status: 200 },
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === 'TimeoutError'
            ? 'Request timed out'
            : err.message
          : 'Unknown error'

      lastFailure = { status: 'offline', error: message }
    }
  }

  return NextResponse.json(lastFailure ?? { status: 'offline', error: 'Probe failed' }, { status: 200 })
}
