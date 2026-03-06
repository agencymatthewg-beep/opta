import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const staticExportEnabled = process.env['OPTA_HOME_STATIC_EXPORT'] === '1'
const isDevelopment = process.env['NODE_ENV'] !== 'production'
const configDir = path.dirname(fileURLToPath(import.meta.url))

if (staticExportEnabled) {
  throw new Error(
    'OPTA_HOME_STATIC_EXPORT=1 is incompatible with app/api/health. Remove the flag or remove the dynamic health route.'
  )
}
const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
]

if (!isDevelopment) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  })
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: configDir,
  async redirects() {
    return [
      {
        source: '/api/health.json',
        destination: '/api/health',
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
