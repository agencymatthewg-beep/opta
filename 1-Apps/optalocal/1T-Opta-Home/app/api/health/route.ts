import { NextResponse } from 'next/server'
import pkg from '../../../package.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type DependencyStatus = 'pass' | 'fail' | 'skipped'

interface DependencyCheck {
  name: string
  target?: string
  status: DependencyStatus
  ok: boolean
  latencyMs?: number
  message?: string
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

async function probeHttpDependency(target: string): Promise<DependencyCheck> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)

  try {
    const response = await fetch(target, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startedAt

    if (response.ok) {
      return {
        name: 'http',
        target,
        status: 'pass',
        ok: true,
        latencyMs,
        message: `HTTP ${response.status}`,
      }
    }

    return {
      name: 'http',
      target,
      status: 'fail',
      ok: false,
      latencyMs,
      message: `HTTP ${response.status}`,
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message =
      error instanceof Error ? error.message : 'Unknown dependency probe error'
    return {
      name: 'http',
      target,
      status: 'fail',
      ok: false,
      latencyMs,
      message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString()
  const dependencyTargets = parseCsvEnv(process.env['HEALTHCHECK_DEPENDENCY_URLS'])

  const dependencyChecks: DependencyCheck[] =
    dependencyTargets.length > 0
      ? await Promise.all(
          dependencyTargets.map((target) => probeHttpDependency(target))
        )
      : [
          {
            name: 'http',
            status: 'skipped',
            ok: true,
            message: 'No HEALTHCHECK_DEPENDENCY_URLS configured',
          },
        ]

  const dependenciesOk = dependencyChecks.every(
    (check) => check.status !== 'fail'
  )

  const payload = {
    status: dependenciesOk ? 'ok' : 'degraded',
    ok: dependenciesOk,
    service: pkg.name,
    version: pkg.version,
    timestamp,
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      dependencies: dependencyChecks,
      environment: {
        node: process.version,
        nodeEnv: process.env['NODE_ENV'] ?? 'unknown',
      },
    },
  }

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
