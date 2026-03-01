import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // No output: 'export' — API routes required for health proxy
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(configDir, '../../..'),
}

export default nextConfig
