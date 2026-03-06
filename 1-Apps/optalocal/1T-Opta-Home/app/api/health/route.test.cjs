const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const compiledRoutePath = path.join(
  process.cwd(),
  '.next',
  'server',
  'app',
  'api',
  'health',
  'route.js'
)

function loadHealthGetHandler() {
  if (!fs.existsSync(compiledRoutePath)) {
    throw new Error(
      `Missing compiled route at ${compiledRoutePath}. Run "npm run build" first.`
    )
  }

  const resolvedPath = require.resolve(compiledRoutePath)
  delete require.cache[resolvedPath]
  const compiledRoute = require(resolvedPath)
  const getHandler = compiledRoute?.routeModule?.userland?.GET

  if (typeof getHandler !== 'function') {
    throw new Error('Unable to resolve compiled GET handler for /api/health.')
  }

  return getHandler
}

async function callHealthRoute({ dependencyUrls, fetchMock }) {
  const originalDependencyUrls = process.env['HEALTHCHECK_DEPENDENCY_URLS']
  const originalFetch = global.fetch

  process.env['HEALTHCHECK_DEPENDENCY_URLS'] = dependencyUrls
  global.fetch = fetchMock

  try {
    const GET = loadHealthGetHandler()
    return GET()
  } finally {
    if (originalDependencyUrls === undefined) {
      delete process.env['HEALTHCHECK_DEPENDENCY_URLS']
    } else {
      process.env['HEALTHCHECK_DEPENDENCY_URLS'] = originalDependencyUrls
    }

    global.fetch = originalFetch
  }
}

test('GET /api/health returns 200 when dependencies are healthy', async () => {
  const response = await callHealthRoute({
    dependencyUrls: 'https://dependency.optalocal.com/healthy',
    fetchMock: async () => new Response(null, { status: 204 }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()

  assert.equal(body.status, 'ok')
  assert.equal(body.ok, true)
  assert.equal(body.checks.dependencies.length, 1)
  assert.equal(body.checks.dependencies[0].status, 'pass')
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
})

test('GET /api/health returns 503 when dependencies are degraded', async () => {
  const response = await callHealthRoute({
    dependencyUrls: 'https://dependency.optalocal.com/degraded',
    fetchMock: async () => new Response(null, { status: 500 }),
  })

  assert.equal(response.status, 503)
  const body = await response.json()

  assert.equal(body.status, 'degraded')
  assert.equal(body.ok, false)
  assert.equal(body.checks.dependencies.length, 1)
  assert.equal(body.checks.dependencies[0].status, 'fail')
})

test('GET /api/health returns skipped dependency when no targets configured', async () => {
  const response = await callHealthRoute({
    dependencyUrls: '',
    fetchMock: async () => {
      throw new Error('fetch should not be called without dependency targets')
    },
  })

  assert.equal(response.status, 200)
  const body = await response.json()

  assert.equal(body.status, 'ok')
  assert.equal(body.ok, true)
  assert.equal(body.checks.dependencies.length, 1)
  assert.equal(body.checks.dependencies[0].status, 'skipped')
  assert.equal(body.checks.dependencies[0].message, 'No HEALTHCHECK_DEPENDENCY_URLS configured')
})

test('GET /api/health returns 503 when dependency probe throws', async () => {
  const response = await callHealthRoute({
    dependencyUrls: 'https://dependency.optalocal.com/throws',
    fetchMock: async () => {
      throw new Error('socket hang up')
    },
  })

  assert.equal(response.status, 503)
  const body = await response.json()

  assert.equal(body.status, 'degraded')
  assert.equal(body.ok, false)
  assert.equal(body.checks.dependencies.length, 1)
  assert.equal(body.checks.dependencies[0].status, 'fail')
  assert.match(body.checks.dependencies[0].message, /socket hang up/)
})

test('GET /api/health degrades when one of multiple dependencies fails', async () => {
  const seenTargets = []
  const response = await callHealthRoute({
    dependencyUrls:
      'https://dependency.optalocal.com/healthy,https://dependency.optalocal.com/unhealthy',
    fetchMock: async (target) => {
      seenTargets.push(target)
      if (String(target).includes('/unhealthy')) {
        return new Response(null, { status: 503 })
      }

      return new Response(null, { status: 204 })
    },
  })

  assert.equal(seenTargets.length, 2)
  assert.equal(response.status, 503)
  const body = await response.json()

  assert.equal(body.status, 'degraded')
  assert.equal(body.ok, false)
  assert.equal(body.checks.dependencies.length, 2)
  assert.equal(
    body.checks.dependencies.some((check) => check.status === 'fail'),
    true
  )
})
