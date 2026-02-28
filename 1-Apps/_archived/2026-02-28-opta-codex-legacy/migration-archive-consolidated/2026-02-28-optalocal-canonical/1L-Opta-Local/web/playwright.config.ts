import { defineConfig, devices } from '@playwright/test';

const PLAYWRIGHT_HOST = '127.0.0.1';
const PLAYWRIGHT_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT ?? '3104');
const PLAYWRIGHT_BASE_URL = `http://${PLAYWRIGHT_HOST}:${PLAYWRIGHT_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: PLAYWRIGHT_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${PLAYWRIGHT_PORT} --hostname ${PLAYWRIGHT_HOST}`,
    url: PLAYWRIGHT_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
