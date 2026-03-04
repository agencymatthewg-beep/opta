import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, ExitError } from '../../src/core/errors.js';

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function deleteByPath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return;
    current = next as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]!];
}

const storeState: Record<string, unknown> = {};
const saveConfigMock = vi.fn(async (updates: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(updates)) {
    setByPath(storeState, key, value);
  }
});

vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn(async () => ({
    connection: {
      host: '192.168.188.11',
      port: 1234,
      adminKey: 'adminkey',
      adminKeysByHost: { '192.168.188.11': 'adminkey' },
    },
    model: { default: 'mlx-community/MiniMax-M2.5-4bit', contextLimit: 197000 },
    provider: { active: 'lmx' },
    defaultMode: 'safe',
  })),
  saveConfig: saveConfigMock,
  getConfigStore: vi.fn(async () => ({
    get: (path: string) => getByPath(storeState, path),
    set: (path: string, value: unknown) => setByPath(storeState, path, value),
    delete: (path: string) => deleteByPath(storeState, path),
  })),
}));

vi.mock('../../src/lmx/client.js', () => ({
  lookupContextLimit: vi.fn(() => 128000),
}));

let stdout: string[] = [];
let stderr: string[] = [];

beforeEach(() => {
  for (const key of Object.keys(storeState)) delete storeState[key];
  saveConfigMock.mockClear();
  stdout = [];
  stderr = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(' '));
  });
});

describe('env command', () => {
  it('normalizes environment profile names', async () => {
    const { normalizeEnvProfileName } = await import('../../src/commands/env.js');
    expect(normalizeEnvProfileName(' Mono 512 ')).toBe('mono-512');
    expect(normalizeEnvProfileName('Opta@Laptop')).toBe('optalaptop');
  });

  it('saves and lists environment profiles', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await envCommand('save', 'mono512', {
      host: '192.168.188.11',
      port: '1234',
      model: 'inferencerlabs/GLM-5-MLX-4.8bit',
      provider: 'lmx',
      mode: 'research',
    });

    stdout = [];
    await envCommand('list', undefined, { json: true });
    const text = stdout.join('\n');
    const parsed = JSON.parse(text) as { current?: string; profiles: Array<{ name: string }> };

    expect(parsed.current).toBe('mono512');
    expect(parsed.profiles.map((p) => p.name)).toContain('mono512');
  });

  it('applies a saved profile with use', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await envCommand('save', 'laptop', {
      host: 'localhost',
      port: '1234',
      model: 'inferencerlabs/GLM-5-MLX-4.8bit',
      provider: 'anthropic',
      mode: 'plan',
      adminKey: '',
    });

    await envCommand('use', 'laptop', {});

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      'connection.host': 'localhost',
      'connection.port': 1234,
      'provider.active': 'anthropic',
      defaultMode: 'plan',
      'model.default': 'inferencerlabs/GLM-5-MLX-4.8bit',
      'model.contextLimit': 128000,
    }));
    expect(getByPath(storeState, 'profiles.activeEnvironment')).toBe('laptop');
  });

  it('normalizes provider aliases when saving profiles', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await envCommand('save', 'cloud', {
      host: 'localhost',
      port: '1234',
      provider: 'claude',
    });
    await envCommand('use', 'cloud', {});

    expect(saveConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ 'provider.active': 'anthropic' })
    );
  });

  it('deletes profiles', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await envCommand('save', 'old', { host: 'localhost', port: '1234' });
    await envCommand('delete', 'old', {});

    stdout = [];
    await envCommand('list', undefined, { json: true });
    const parsed = JSON.parse(stdout.join('\n')) as { profiles: unknown[] };
    expect(parsed.profiles).toHaveLength(0);
  });

  it('saves and applies host-specific admin key maps', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await envCommand('save', 'cluster', {
      host: '192.168.188.11',
      port: '1234',
      adminKeysByHost: '{"192.168.188.11":"key-a","192.168.188.8":"key-b"}',
    });

    await envCommand('use', 'cluster', {});
    expect(getByPath(storeState, 'connection.adminKeysByHost')).toEqual({
      '192.168.188.11': 'key-a',
      '192.168.188.8': 'key-b',
    });
  });

  it('fails with misuse for invalid provider', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await expect(envCommand('save', 'bad', { provider: 'unknown' }))
      .rejects.toMatchObject<ExitError>({ exitCode: EXIT.MISUSE });
    expect(stderr.join('\n')).toContain('Invalid provider');
  });

  it('fails with misuse for invalid admin-keys-by-host format', async () => {
    const { envCommand } = await import('../../src/commands/env.js');

    await expect(envCommand('save', 'badkeys', { adminKeysByHost: 'not-json' }))
      .rejects.toMatchObject<ExitError>({ exitCode: EXIT.MISUSE });
    expect(stderr.join('\n')).toContain('Invalid admin-keys-by-host format');
  });
});
