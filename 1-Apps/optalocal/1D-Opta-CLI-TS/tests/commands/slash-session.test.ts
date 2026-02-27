import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

describe('/sessions slash command parity', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let sessionsMock: ReturnType<typeof vi.fn>;
  let logs: string[] = [];

  beforeEach(async () => {
    vi.resetModules();
    logs = [];
    sessionsMock = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/commands/sessions.js', () => ({
      sessions: sessionsMock,
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

  it('forwards list filters/options to command sessions()', async () => {
    const result = await dispatchSlashCommand(
      '/sessions list --json --model minimax --since 7d --tag bugfix --limit 10',
      makeCtx(),
    );

    expect(result).toBe('handled');
    expect(sessionsMock).toHaveBeenCalledWith('list', undefined, {
      json: true,
      model: 'minimax',
      since: '7d',
      tag: 'bugfix',
      limit: '10',
    });
  });

  it('preserves multi-word search queries', async () => {
    const result = await dispatchSlashCommand('/sessions search "auth refresh failure"', makeCtx());

    expect(result).toBe('handled');
    expect(sessionsMock).toHaveBeenCalledWith('search', 'auth refresh failure', {});
  });

  it('prints usage on unknown options and does not call sessions()', async () => {
    const result = await dispatchSlashCommand('/sessions list --unknown', makeCtx());

    expect(result).toBe('handled');
    expect(sessionsMock).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Unknown options');
    expect(logs.join('\n')).toContain('Usage: /sessions');
  });
});
