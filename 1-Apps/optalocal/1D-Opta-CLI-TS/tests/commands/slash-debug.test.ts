import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

describe('/debug slash command', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let logs: string[] = [];
  let healthMock: ReturnType<typeof vi.fn>;
  let runDoctorMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    logs = [];
    healthMock = vi.fn().mockResolvedValue({ ok: true });
    runDoctorMock = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        health = healthMock;
        getActiveHost() {
          return 'localhost';
        }
      },
    }));

    vi.doMock('../../src/commands/doctor.js', () => ({
      runDoctor: runDoctorMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-debug', messages: [], toolCallCount: 0 },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('renders JSON snapshot output with /debug --json', async () => {
    const result = await dispatchSlashCommand('/debug --json', makeCtx());
    expect(result).toBe('handled');
    const output = logs.join('\n');
    expect(output).toContain('"sessionId": "session-debug"');
    expect(output).toContain('"reachable": true');
    expect(output).toContain('"provider": "lmx"');
  });

  it('runs doctor when requested with /debug --doctor', async () => {
    const result = await dispatchSlashCommand('/debug --doctor', makeCtx());
    expect(result).toBe('handled');
    expect(runDoctorMock).toHaveBeenCalledWith({ fix: false });
  });
});

describe('/stats slash command routing', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let logs: string[] = [];

  beforeEach(async () => {
    vi.resetModules();
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/memory/store.js', () => ({
      listSessions: vi.fn().mockResolvedValue([
        {
          id: 's1',
          title: 'Session One',
          tags: ['debug'],
          model: 'minimax',
          created: new Date().toISOString(),
          messageCount: 2,
          toolCallCount: 1,
        },
      ]),
    }));

    vi.doMock('../../src/memory/analytics.js', () => ({
      SessionAnalytics: class {
        totalSessions = 1;
        totalMessages = 2;
        totalToolCalls = 1;
        avgMessagesPerSession = 2;
        modelBreakdown = { minimax: 1 };

        sessionsToday() {
          return 1;
        }
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-stats', messages: [], toolCallCount: 0 },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('dispatches /stats to session analytics handler', async () => {
    const result = await dispatchSlashCommand('/stats', makeCtx());
    expect(result).toBe('handled');
    expect(logs.join('\n')).toContain('Session Analytics');
  });
});
