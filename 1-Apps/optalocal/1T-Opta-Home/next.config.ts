import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // No output: 'export' — Vercel builds Next.js natively
  // Static pages are still served as static content on Vercel CDN
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(configDir, '../../..'),
}

export default nextConfig
