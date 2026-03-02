import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: path.join(configDir, '../../..'),
};

export default config;
