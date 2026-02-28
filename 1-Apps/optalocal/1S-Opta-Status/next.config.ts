import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // No output: 'export' — API routes required for health proxy
  images: {
    unoptimized: true,
  },
}

export default nextConfig
