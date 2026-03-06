import type { NextConfig } from 'next';
import path from 'node:path';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const config: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
