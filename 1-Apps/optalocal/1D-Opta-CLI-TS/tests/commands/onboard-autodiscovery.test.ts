import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  discoverLmxHosts: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: mocks.saveConfig,
}));

vi.mock('../../src/lmx/mdns-discovery.js', () => ({
  discoverLmxHosts: mocks.discoverLmxHosts,
}));

vi.mock('node:fs/promises', () => ({
  access: mocks.access,
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

describe('applyOnboardingProfile autodiscovery defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue(null);
    mocks.saveConfig.mockResolvedValue(undefined);
    mocks.discoverLmxHosts.mockResolvedValue([]);
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.access.mockRejectedValue(new Error('not found'));
  });

  it('uses discovered LMX endpoint when no explicit host is provided', async () => {
    mocks.discoverLmxHosts.mockResolvedValue([
      { host: 'mono512.local', port: 1234, latencyMs: 12 },
    ]);

    const { applyOnboardingProfile } = await import('../../src/commands/onboard.js');
    const result = await applyOnboardingProfile({ provider: 'lmx' });

    expect(result.connection).toEqual({ host: 'mono512.local', port: 1234 });
    expect(mocks.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        'connection.host': 'mono512.local',
        'connection.port': '1234',
      })
    );
  });

  it('falls back to localhost instead of static private LAN IP', async () => {
    const { applyOnboardingProfile } = await import('../../src/commands/onboard.js');
    const result = await applyOnboardingProfile({ provider: 'lmx' });

    expect(result.connection).toEqual({ host: 'localhost', port: 1234 });
    expect(mocks.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        'connection.host': 'localhost',
        'connection.port': '1234',
      })
    );
  });
});
