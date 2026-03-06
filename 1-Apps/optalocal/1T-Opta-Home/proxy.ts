import { NextRequest, NextResponse } from 'next/server'

const isDevelopment = process.env['NODE_ENV'] !== 'production'

function buildContentSecurityPolicy(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(' ')

  const connectSrc = [
    "'self'",
    ...(isDevelopment ? ['https:', 'wss:'] : []),
  ].join(' ')

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
    'block-all-mixed-content',
  ].join('; ')
}

function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce()
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('content-security-policy', contentSecurityPolicy)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('content-security-policy', contentSecurityPolicy)

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
