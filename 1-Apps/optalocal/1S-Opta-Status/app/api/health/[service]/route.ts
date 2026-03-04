import { NextRequest, NextResponse } from 'next/server'
import websitesRegistry from '../../../websites.registry.generated.json'

export const revalidate = 30

const DEFAULT_TIMEOUT_MS = 9000
const DEFAULT_CACHE_TTL_MS = 15000
const DEFAULT_STALE_TTL_MS = 120000

type HealthPayload = Record<string, unknown>
type ProbeFailure =
  | {
      status: 'degraded'
      latency: number
    }
  | {
      status: 'offline'
      error: string
    }
type ProbeOutcome = {
  payload: HealthPayload | ProbeFailure
  transientFailure: boolean
  successfulProbe: boolean
}
type CacheEntry = {
  payload: HealthPayload | ProbeFailure
  cachedAt: number
  expiresAt: number
  staleUntil: number
}
type CacheMeta = {
  hit: boolean
  stale: boolean
  ageMs: number
  ttlMs: number
  staleTtlMs: number
}

const HEALTH_RESPONSE_CACHE = new Map<string, CacheEntry>()
const IN_FLIGHT_PROBES = new Map<string, Promise<ProbeOutcome>>()

function readDurationMs(envName: string, fallbackMs: number): number {
  const raw = process.env[envName]?.trim()
  if (!raw) {
    return fallbackMs
  }

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs
}

function isTruthyParam(value: string | null): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function withProbeCacheMeta<T extends HealthPayload | ProbeFailure>(payload: T, cacheMeta: CacheMeta): T & { probeCache: CacheMeta } {
  return {
    ...payload,
    probeCache: cacheMeta,
  }
}

async function getOrStartProbe(cacheKey: string, run: () => Promise<ProbeOutcome>): Promise<ProbeOutcome> {
  const existing = IN_FLIGHT_PROBES.get(cacheKey)
  if (existing) {
    return existing
  }

  const probePromise = run().finally(() => {
    IN_FLIGHT_PROBES.delete(cacheKey)
  })
  IN_FLIGHT_PROBES.set(cacheKey, probePromise)
  return probePromise
}

function isTransientStatusCode(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504
}

async function probeService(
  service: string,
  probePaths: string[],
  normalizedBaseUrl: string,
  timeoutMs: number,
): Promise<ProbeOutcome> {
  let lastFailure: ProbeFailure | null = null
  let sawTransientFailure = false

  for (const probePath of probePaths) {
    const url = `${normalizedBaseUrl}${probePath}`

    try {
      const start = Date.now()
      const headers: Record<string, string> = { Accept: 'application/json' }
      const daemonToken = process.env['OPTA_DAEMON_TOKEN']?.trim()
      if (service === 'daemon' && probePath === '/v3/health' && daemonToken) {
        headers['Authorization'] = `Bearer ${daemonToken}`
      }
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers,
        cache: 'no-store',
      })
      const latency = Date.now() - start

      if (!response.ok) {
        lastFailure = { status: 'degraded', latency }
        sawTransientFailure = sawTransientFailure || isTransientStatusCode(response.status)
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
      const statusText = typeof upstreamStatus === 'string' ? upstreamStatus.toLowerCase() : ''
      const okField = typeof rest.ok === 'boolean' ? rest.ok : undefined
      const upstreamDegraded =
        statusText === 'degraded' ||
        statusText === 'unavailable' ||
        statusText === 'fail' ||
        statusText === 'failed'
      const derivedStatus: 'online' | 'degraded' = upstreamDegraded || okField === false ? 'degraded' : 'online'

      return {
        payload: {
          status: derivedStatus,
          latency,
          ...(typeof upstreamStatus === 'string' ? { upstreamStatus } : {}),
          ...rest,
        },
        transientFailure: false,
        successfulProbe: true,
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === 'TimeoutError'
            ? 'Request timed out'
            : err.message
          : 'Unknown error'

      sawTransientFailure = true
      lastFailure = { status: 'offline', error: message }
    }
  }

  return {
    payload: lastFailure ?? { status: 'offline', error: 'Probe failed' },
    transientFailure: sawTransientFailure,
    successfulProbe: false,
  }
}

// Service definitions: maps service ID → { base URL env var or literal, health path }
type ServiceDefinition = {
  urlEnv?: string
  urlEnvFallbacks?: string[]
  urlFallback?: string
  path?: string
  paths?: string[]
}

type RegistryWebsite = {
  domain: string
  healthPath: string
  statusServiceId: string | null
}

function isRegistryWebsite(value: unknown): value is RegistryWebsite {
  if (!value || typeof value !== 'object') return false
  const website = value as Partial<RegistryWebsite>
  const hasDomain = typeof website.domain === 'string' && website.domain.trim().length > 0
  const hasHealthPath = typeof website.healthPath === 'string' && website.healthPath.trim().length > 0
  const hasServiceId =
    typeof website.statusServiceId === 'string' || website.statusServiceId === null
  return hasDomain && hasHealthPath && hasServiceId
}

function buildWebsiteServiceDefinitions(): Record<string, ServiceDefinition> {
  const websites = Array.isArray(websitesRegistry.websites) ? websitesRegistry.websites : []
  const definitions: Record<string, ServiceDefinition> = {}

  for (const rawWebsite of websites) {
    if (!isRegistryWebsite(rawWebsite)) continue
    const serviceId = rawWebsite.statusServiceId
    if (typeof serviceId !== 'string' || serviceId.trim().length === 0) continue

    const normalizedServiceId = serviceId.trim().toLowerCase()
    const definition: ServiceDefinition = {
      urlFallback: `https://${rawWebsite.domain.trim()}`,
      path: rawWebsite.healthPath.trim(),
    }

    if (normalizedServiceId === 'local') {
      definition.urlEnv = 'OPTA_LOCAL_URL'
    } else if (normalizedServiceId === 'accounts') {
      definition.urlEnv = 'OPTA_ACCOUNTS_URL'
    } else if (normalizedServiceId === 'admin') {
      definition.urlEnv = 'OPTA_ADMIN_URL'
    }

    definitions[normalizedServiceId] = definition
  }

  return definitions
}

const BASE_SERVICES: Record<string, ServiceDefinition> = {
  lmx: {
    // Health-only hostname for LMX. Legacy env is still accepted for compatibility.
    urlEnv: 'OPTA_LMX_HEALTH_URL',
    urlEnvFallbacks: ['OPTA_LMX_TUNNEL_URL'],
    paths: ['/readyz', '/healthz'],
  },
  daemon: {
    // Optional deep status URL can be set separately from the simple health tunnel.
    urlEnv: 'OPTA_DAEMON_STATUS_URL',
    urlEnvFallbacks: ['OPTA_DAEMON_TUNNEL_URL'],
    paths: ['/v3/health', '/health'],
  },
  code: {
    urlEnv: 'OPTA_CODE_URL',
    urlFallback: 'https://optalocal.com',
    path: '/',
  },
}

const SERVICES: Record<string, ServiceDefinition> = {
  ...BASE_SERVICES,
  ...buildWebsiteServiceDefinitions(),
}

export async function GET(
  request: NextRequest,
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

  // Resolve base URL from env var(s) (trimmed) or fallback.
  // Trimming avoids subtle failures from newline-contaminated env values.
  const envVars = [def.urlEnv, ...(def.urlEnvFallbacks ?? [])].filter(
    (name): name is string => Boolean(name)
  )
  const envUrl = envVars
    .map((name) => process.env[name]?.trim())
    .find((value): value is string => Boolean(value))
  const baseUrl = envUrl || def.urlFallback?.trim()

  if (!baseUrl) {
    const missingEnvLabel = envVars.length > 0 ? envVars.join(' or ') : def.urlEnv
    return NextResponse.json(
      { status: 'unconfigured', error: `${missingEnvLabel} is not set` },
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
  const timeoutMs = readDurationMs('OPTA_STATUS_HEALTH_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const cacheTtlMs = readDurationMs('OPTA_STATUS_HEALTH_CACHE_TTL_MS', DEFAULT_CACHE_TTL_MS)
  const staleTtlMs = readDurationMs('OPTA_STATUS_HEALTH_STALE_TTL_MS', DEFAULT_STALE_TTL_MS)
  const searchParams = request.nextUrl.searchParams
  const forceLiveProbe =
    isTruthyParam(searchParams.get('fresh')) ||
    isTruthyParam(searchParams.get('deep')) ||
    isTruthyParam(searchParams.get('force')) ||
    searchParams.get('check')?.trim().toLowerCase() === 'fresh' ||
    searchParams.get('check')?.trim().toLowerCase() === 'deep'
  const cacheKey = `${service}|${normalizedBaseUrl}|${probePaths.join(',')}`
  const now = Date.now()
  const cached = HEALTH_RESPONSE_CACHE.get(cacheKey)

  if (!forceLiveProbe && cached && cached.expiresAt > now) {
    const payload = withProbeCacheMeta(cached.payload, {
      hit: true,
      stale: false,
      ageMs: now - cached.cachedAt,
      ttlMs: cacheTtlMs,
      staleTtlMs,
    })
    return NextResponse.json(payload, { status: 200 })
  }

  const outcome = await getOrStartProbe(cacheKey, () =>
    probeService(service, probePaths, normalizedBaseUrl, timeoutMs),
  )

  if (outcome.successfulProbe) {
    const refreshedAt = Date.now()
    HEALTH_RESPONSE_CACHE.set(cacheKey, {
      payload: outcome.payload,
      cachedAt: refreshedAt,
      expiresAt: refreshedAt + cacheTtlMs,
      staleUntil: refreshedAt + staleTtlMs,
    })
    return NextResponse.json(outcome.payload, { status: 200 })
  }

  const canUseStale = Boolean(cached && cached.staleUntil > now && outcome.transientFailure)
  if (canUseStale && cached) {
    const payload = withProbeCacheMeta(cached.payload, {
      hit: true,
      stale: true,
      ageMs: now - cached.cachedAt,
      ttlMs: cacheTtlMs,
      staleTtlMs,
    })
    return NextResponse.json(payload, { status: 200 })
  }

  return NextResponse.json(outcome.payload, { status: 200 })
}
