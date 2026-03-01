import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!key) continue;
    const current = cursor[key];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  if (!leaf) return;
  cursor[leaf] = value;
}

describe('/autonomy slash command', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let logs: string[] = [];
  let persistedConfig: Record<string, unknown>;
  let saveConfigMock: ReturnType<typeof vi.fn>;
  let loadConfigMock: ReturnType<typeof vi.fn>;
  let startBrowserLiveHostMock: ReturnType<typeof vi.fn>;
  let isPeekabooAvailableMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    logs = [];
    persistedConfig = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    saveConfigMock = vi.fn(async (updates: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(updates)) {
        setByPath(persistedConfig, key, value);
      }
    });
    loadConfigMock = vi.fn(async () => structuredClone(persistedConfig));
    startBrowserLiveHostMock = vi.fn().mockResolvedValue({
      host: '127.0.0.1',
      controlPort: 46600,
      slots: [
        { port: 46601 },
        { port: 46602 },
        { port: 46603 },
        { port: 46604 },
        { port: 46605 },
      ],
    });
    isPeekabooAvailableMock = vi.fn().mockResolvedValue(true);

    vi.doMock('../../src/core/config.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
        '../../src/core/config.js',
      );
      return {
        ...actual,
        saveConfig: saveConfigMock,
        loadConfig: loadConfigMock,
      };
    });
    vi.doMock('../../src/browser/live-host.js', () => ({
      startBrowserLiveHost: startBrowserLiveHostMock,
    }));
    vi.doMock('../../src/browser/peekaboo.js', () => ({
      isPeekabooAvailable: isPeekabooAvailableMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-workflow', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('requires dangerous mode or auto-accept for ceo-max', async () => {
    const ctx = makeCtx();
    ctx.config.defaultMode = 'normal';
    ctx.chatState.autoAccept = false;
    ctx.config.computerControl.foreground.enabled = true;
    ctx.config.computerControl.foreground.allowScreenActions = true;

    const result = await dispatchSlashCommand('/autonomy ceo-max', ctx);
    expect(result).toBe('handled');
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(startBrowserLiveHostMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('requires dangerous mode');
  });

  it('requires foreground screen-action control for ceo-max', async () => {
    const ctx = makeCtx();
    ctx.config.defaultMode = 'dangerous';
    ctx.config.computerControl.foreground.enabled = false;
    ctx.config.computerControl.foreground.allowScreenActions = false;

    const result = await dispatchSlashCommand('/autonomy ceo-max', ctx);
    expect(result).toBe('handled');
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(startBrowserLiveHostMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Foreground computer control is disabled');
  });

  it('requires peekaboo availability for ceo-max', async () => {
    const ctx = makeCtx();
    ctx.config.defaultMode = 'dangerous';
    ctx.config.computerControl.foreground.enabled = true;
    ctx.config.computerControl.foreground.allowScreenActions = true;
    isPeekabooAvailableMock.mockResolvedValueOnce(false);

    const result = await dispatchSlashCommand('/autonomy ceo-max', ctx);
    expect(result).toBe('handled');
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(startBrowserLiveHostMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Peekaboo is required for /autonomy ceo-max.');
  });

  it('enables ceo-max and starts live host when requirements are met', async () => {
    const ctx = makeCtx();
    ctx.config.defaultMode = 'dangerous';
    ctx.config.browser.runtime.maxSessions = 3;
    ctx.config.computerControl.foreground.enabled = true;
    ctx.config.computerControl.foreground.allowScreenActions = true;
    ctx.config.computerControl.background.maxHostedBrowserSessions = 4;

    const result = await dispatchSlashCommand('/autonomy ceo-max', ctx);
    expect(result).toBe('handled');

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      'autonomy.level': 5,
      'autonomy.mode': 'ceo',
      'autonomy.headlessContinue': true,
      'browser.enabled': true,
      'browser.runtime.enabled': true,
      'browser.runtime.maxSessions': 4,
    }));
    expect(startBrowserLiveHostMock).toHaveBeenCalledWith(expect.objectContaining({
      includePeekabooScreen: true,
      maxSessionSlots: 4,
      requiredPortCount: 6,
    }));

    const output = logs.join('\n');
    expect(output).toContain('CEO max autonomy set');
    expect(output).toContain('Live host: http://127.0.0.1:46600');
    expect(output).toContain('Peekaboo screen: http://127.0.0.1:46600/screen');
  });

  it('rolls back config when ceo-max host startup fails', async () => {
    const ctx = makeCtx();
    ctx.config.defaultMode = 'dangerous';
    ctx.config.computerControl.foreground.enabled = true;
    ctx.config.computerControl.foreground.allowScreenActions = true;
    ctx.config.autonomy.level = 2;
    ctx.config.autonomy.mode = 'execution';
    ctx.config.autonomy.headlessContinue = false;
    ctx.config.browser.enabled = false;
    ctx.config.browser.runtime.enabled = false;
    ctx.config.browser.runtime.maxSessions = 2;
    persistedConfig = structuredClone(ctx.config) as unknown as Record<string, unknown>;

    startBrowserLiveHostMock.mockRejectedValueOnce(new Error('port scan failed'));

    const result = await dispatchSlashCommand('/autonomy ceo-max', ctx);
    expect(result).toBe('handled');
    expect(saveConfigMock).toHaveBeenCalledTimes(2);
    expect(saveConfigMock.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      'autonomy.level': 2,
      'autonomy.mode': 'execution',
      'autonomy.headlessContinue': false,
      'browser.enabled': false,
      'browser.runtime.enabled': false,
      'browser.runtime.maxSessions': 2,
    }));
    expect(logs.join('\n')).toContain('Unable to enable CEO max autonomy: port scan failed');
  });

  it('rejects invalid set/mode inputs instead of silently coercing', async () => {
    const ctx = makeCtx();

    const badSet = await dispatchSlashCommand('/autonomy set nope', ctx);
    expect(badSet).toBe('handled');
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Usage: /autonomy');

    logs = [];
    const badMode = await dispatchSlashCommand('/autonomy mode nope', ctx);
    expect(badMode).toBe('handled');
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Usage: /autonomy');
  });

  it('disables headlessContinue when leaving ceo-max profile', async () => {
    const ctx = makeCtx();
    ctx.config.autonomy.level = 5;
    ctx.config.autonomy.mode = 'ceo';
    ctx.config.autonomy.headlessContinue = true;

    const result = await dispatchSlashCommand('/autonomy down', ctx);
    expect(result).toBe('handled');
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      'autonomy.headlessContinue': false,
    }));
  });
});
