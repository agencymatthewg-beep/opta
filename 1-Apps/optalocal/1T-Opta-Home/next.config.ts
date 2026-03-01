import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // No output: 'export' — Vercel builds Next.js natively
  // Static pages are still served as static content on Vercel CDN
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
