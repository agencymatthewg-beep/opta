import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, ExitError } from '../../src/core/errors.js';

const execaMock = vi.fn();
const loadConfigMock = vi.fn();
const getConfigStoreMock = vi.fn();

vi.mock('execa', () => ({
  execa: (...args: unknown[]) => execaMock(...args),
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: () => loadConfigMock(),
  getConfigStore: () => getConfigStoreMock(),
}));

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });
}

function baseConfig() {
  return {
    connection: {
      apiKey: 'opta_sk_cfg_value',
      host: 'localhost',
      fallbackHosts: [],
      port: 1234,
      adminKey: 'admin-key',
      ssh: {
        user: 'opta',
        identityFile: '~/.ssh/id_ed25519',
        lmxPath: '/tmp/opta-lmx',
        pythonPath: 'python3',
      },
    },
  };
}

describe('key command clipboard (Windows)', () => {
  const originalOptaApiKey = process.env['OPTA_API_KEY'];
  let stdout: string[] = [];

  beforeEach(() => {
    setPlatform('win32');
    vi.resetModules();
    execaMock.mockReset();
    loadConfigMock.mockReset();
    getConfigStoreMock.mockReset();
    loadConfigMock.mockResolvedValue(baseConfig());
    stdout = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdout.push(args.map(String).join(' '));
    });
    delete process.env['OPTA_API_KEY'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOptaApiKey === undefined) {
      delete process.env['OPTA_API_KEY'];
    } else {
      process.env['OPTA_API_KEY'] = originalOptaApiKey;
    }
  });

  it('uses powershell Set-Clipboard on win32 when available', async () => {
    execaMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' });
    const { keyCopy } = await import('../../src/commands/key.js');

    await keyCopy({ json: true });

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith(
      'powershell',
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Set-Clipboard -Value ([Console]::In.ReadToEnd())',
      ]),
      expect.objectContaining({
        input: 'opta_sk_cfg_value',
        reject: false,
      }),
    );

    const payload = JSON.parse(stdout.join('\n')) as { ok: boolean; message: string };
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain('powershell');
  });

  it('falls back to clip when powershell clipboard fails', async () => {
    execaMock
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'Set-Clipboard failed' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' });

    const { keyCopy } = await import('../../src/commands/key.js');
    await keyCopy({ json: true });

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(execaMock).toHaveBeenNthCalledWith(
      1,
      'powershell',
      expect.any(Array),
      expect.objectContaining({ input: 'opta_sk_cfg_value', reject: false }),
    );
    expect(execaMock).toHaveBeenNthCalledWith(
      2,
      'clip',
      [],
      expect.objectContaining({ input: 'opta_sk_cfg_value', reject: false }),
    );

    const payload = JSON.parse(stdout.join('\n')) as { ok: boolean; message: string };
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain('clip');
  });

  it('returns an error and throws when all clipboard options fail', async () => {
    execaMock
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'Set-Clipboard failed' })
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'clip failed' });

    const { keyCopy } = await import('../../src/commands/key.js');

    await expect(keyCopy({ json: true })).rejects.toMatchObject<ExitError>({
      exitCode: EXIT.ERROR,
    });

    const payload = JSON.parse(stdout.join('\n')) as { ok: boolean; message: string };
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain('no clipboard utility succeeded');
  });
});
