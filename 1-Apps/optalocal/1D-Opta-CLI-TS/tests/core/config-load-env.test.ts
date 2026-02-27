import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockConf {
  store: Record<string, unknown>;

  constructor() {
    this.store = {};
  }

  clear(): void {
    this.store = {};
  }

  get(key: string): unknown {
    return this.store[key];
  }

  set(key: string, value: unknown): void {
    this.store[key] = value;
  }

  delete(key: string): void {
    delete this.store[key];
  }
}

vi.mock('conf', () => ({ default: MockConf }));
vi.mock('cosmiconfig', () => ({
  cosmiconfig: vi.fn(() => ({
    search: vi.fn().mockResolvedValue(null),
  })),
}));

import { clearLoadConfigCache, getConfigStore, loadConfig } from '../../src/core/config.js';

const ORIGINAL_OPTA_API_KEY = process.env['OPTA_API_KEY'];
const ORIGINAL_OPTA_DISK_HEADROOM_MB = process.env['OPTA_DISK_HEADROOM_MB'];

beforeEach(async () => {
  clearLoadConfigCache();
  const store = await getConfigStore();
  store.clear();
  delete process.env['OPTA_API_KEY'];
  delete process.env['OPTA_DISK_HEADROOM_MB'];
});

afterEach(() => {
  clearLoadConfigCache();
  if (ORIGINAL_OPTA_API_KEY === undefined) {
    delete process.env['OPTA_API_KEY'];
  } else {
    process.env['OPTA_API_KEY'] = ORIGINAL_OPTA_API_KEY;
  }

  if (ORIGINAL_OPTA_DISK_HEADROOM_MB === undefined) {
    delete process.env['OPTA_DISK_HEADROOM_MB'];
  } else {
    process.env['OPTA_DISK_HEADROOM_MB'] = ORIGINAL_OPTA_DISK_HEADROOM_MB;
  }
});

describe('loadConfig env overrides', () => {
  it('applies OPTA_API_KEY override to connection.apiKey', async () => {
    process.env['OPTA_API_KEY'] = 'env-lmx-key';
    const config = await loadConfig();
    expect(config.connection.apiKey).toBe('env-lmx-key');
  });

  it('refreshes when OPTA_API_KEY changes between calls', async () => {
    process.env['OPTA_API_KEY'] = 'first-key';
    const first = await loadConfig();
    expect(first.connection.apiKey).toBe('first-key');

    process.env['OPTA_API_KEY'] = 'second-key';
    const second = await loadConfig();
    expect(second.connection.apiKey).toBe('second-key');
  });

  it('clearLoadConfigCache forces reload from persisted config', async () => {
    const store = await getConfigStore();
    store.set('connection', { host: 'host-a' });

    const first = await loadConfig();
    expect(first.connection.host).toBe('host-a');

    store.set('connection', { host: 'host-b' });
    clearLoadConfigCache();
    const second = await loadConfig();
    expect(second.connection.host).toBe('host-b');
  });

  it('applies OPTA_DISK_HEADROOM_MB override to safety.diskHeadroomMb', async () => {
    process.env['OPTA_DISK_HEADROOM_MB'] = '96';
    const config = await loadConfig();
    expect(config.safety.diskHeadroomMb).toBe(96);
  });

  it('refreshes when OPTA_DISK_HEADROOM_MB changes between calls', async () => {
    process.env['OPTA_DISK_HEADROOM_MB'] = '64';
    const first = await loadConfig();
    expect(first.safety.diskHeadroomMb).toBe(64);

    process.env['OPTA_DISK_HEADROOM_MB'] = '128';
    const second = await loadConfig();
    expect(second.safety.diskHeadroomMb).toBe(128);
  });
});
