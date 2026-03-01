import { describe, it, expect, vi, afterEach } from 'vitest';

// Re-import after each env override to get fresh resolution
async function freshImport() {
  // Clear module cache for the paths module
  vi.resetModules();
  return import('../../src/platform/paths.js');
}

describe('platform/paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('getConfigDir returns a path ending in /opta', async () => {
    const { getConfigDir } = await freshImport();
    const dir = getConfigDir();
    expect(dir).toMatch(/opta$/);
  });

  it('getSessionsDir returns <configDir>/sessions', async () => {
    const { getConfigDir, getSessionsDir } = await freshImport();
    expect(getSessionsDir()).toBe(`${getConfigDir()}/sessions`);
  });

  it('getDaemonDir returns <configDir>/daemon', async () => {
    const { getConfigDir, getDaemonDir } = await freshImport();
    expect(getDaemonDir()).toBe(`${getConfigDir()}/daemon`);
  });

  it('getThemesDir returns <configDir>/themes', async () => {
    const { getConfigDir, getThemesDir } = await freshImport();
    expect(getThemesDir()).toBe(`${getConfigDir()}/themes`);
  });

  it('respects XDG_CONFIG_HOME when set', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/custom/config');
    const { getConfigDir } = await freshImport();
    expect(getConfigDir()).toBe('/custom/config/opta');
  });
});
