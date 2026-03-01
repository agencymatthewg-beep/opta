import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: configDir,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'auth.optalocal.com' }],
        destination: 'https://accounts.optalocal.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'login.optalocal.com' }],
        destination: 'https://accounts.optalocal.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
