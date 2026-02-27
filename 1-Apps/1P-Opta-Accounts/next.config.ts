import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: '.',
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
