import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite-level cache directory (also used by Vitest)
  cacheDir: 'node_modules/.vitest',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Kill any test that hangs for more than 10s (prevents agent/LSP/LMX socket hangs)
    testTimeout: 10000,
    hookTimeout: 5000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 30,
        branches: 20,
        functions: 25,
        lines: 30,
      },
    },
  },
});
