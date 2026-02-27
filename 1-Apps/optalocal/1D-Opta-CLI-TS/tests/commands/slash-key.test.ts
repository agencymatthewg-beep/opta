import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

describe('/key slash command parity', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let keyCreateMock: ReturnType<typeof vi.fn>;
  let keyShowMock: ReturnType<typeof vi.fn>;
  let keyCopyMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    keyCreateMock = vi.fn().mockResolvedValue(undefined);
    keyShowMock = vi.fn().mockResolvedValue(undefined);
    keyCopyMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/commands/key.js', () => ({
      keyCreate: keyCreateMock,
      keyShow: keyShowMock,
      keyCopy: keyCopyMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /key create options to keyCreate', async () => {
    const result = await dispatchSlashCommand(
      '/key create --value opta_sk_custom --no-remote --no-copy --json',
      makeCtx(),
    );
    expect(result).toBe('handled');
    expect(keyCreateMock).toHaveBeenCalledWith({
      value: 'opta_sk_custom',
      remote: false,
      copy: false,
      json: true,
    });
  });

  it('routes /key show options to keyShow', async () => {
    const result = await dispatchSlashCommand('/key show --reveal --copy --json', makeCtx());
    expect(result).toBe('handled');
    expect(keyShowMock).toHaveBeenCalledWith({
      reveal: true,
      copy: true,
      json: true,
    });
  });

  it('defaults /key to show mode', async () => {
    const result = await dispatchSlashCommand('/key --json', makeCtx());
    expect(result).toBe('handled');
    expect(keyShowMock).toHaveBeenCalledWith({ json: true });
  });

  it('routes /key copy to keyCopy', async () => {
    const result = await dispatchSlashCommand('/key copy --json', makeCtx());
    expect(result).toBe('handled');
    expect(keyCopyMock).toHaveBeenCalledWith({ json: true });
  });
});
