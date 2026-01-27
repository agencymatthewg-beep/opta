import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable edge runtime for Cloudflare Pages
  experimental: {
    // Required for Cloudflare Pages deployment
  },
};

export default nextConfig;
