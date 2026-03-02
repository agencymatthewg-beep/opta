import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.join(configDir, '../../..')

const nextConfig: NextConfig = {
  // No output: 'export' — API routes required for health proxy
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
}

export default nextConfig
