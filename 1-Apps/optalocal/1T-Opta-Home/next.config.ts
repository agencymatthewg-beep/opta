import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const staticExportEnabled = process.env['OPTA_HOME_STATIC_EXPORT'] === '1'
const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  ...(staticExportEnabled ? { output: 'export' as const } : {}),
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: configDir,
}

export default nextConfig
