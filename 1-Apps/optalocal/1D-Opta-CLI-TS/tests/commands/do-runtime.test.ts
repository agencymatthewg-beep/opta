import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_CONFIG = {
  connection: { host: '127.0.0.1', port: 11434 },
  model: { default: 'test-model' },
};

describe('executeTask runtime daemon paths', () => {
  let logs: string[] = [];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function loadExecuteTaskWithMocks(params: {
    daemonLegacyChat: ReturnType<typeof vi.fn>;
    daemonConnectError?: Error;
    agentLoopResult?: { messages: Array<{ role: string; content?: string }>; toolCallCount: number };
  }) {
    const loadConfig = vi.fn().mockResolvedValue(BASE_CONFIG);
    const agentLoop = vi.fn().mockResolvedValue(
      params.agentLoopResult ?? {
        messages: [{ role: 'assistant', content: 'fallback response' }],
        toolCallCount: 1,
      }
    );

    const daemonConnect = params.daemonConnectError
      ? vi.fn().mockRejectedValue(params.daemonConnectError)
      : vi.fn().mockResolvedValue({
        legacyChat: params.daemonLegacyChat,
      });

    vi.doMock('../../src/core/config.js', () => ({
      loadConfig,
    }));
    vi.doMock('../../src/core/agent.js', () => ({
      agentLoop,
    }));
    vi.doMock('../../src/daemon/client.js', () => ({
      DaemonClient: { connect: daemonConnect },
    }));

    const { executeTask } = await import('../../src/commands/do.js');
    return { executeTask, loadConfig, agentLoop, daemonConnect };
  }

  it('uses daemon legacy chat result on success (no local fallback)', async () => {
    const legacyChat = vi.fn().mockResolvedValue({
      response: 'daemon completed task',
      stats: { toolCalls: 2 },
      model: 'daemon-model',
    });

    const { executeTask, agentLoop, daemonConnect } = await loadExecuteTaskWithMocks({
      daemonLegacyChat: legacyChat,
    });

    await executeTask(['ship', 'the', 'fix'], {});

    expect(daemonConnect).toHaveBeenCalledTimes(1);
    expect(legacyChat).toHaveBeenCalledWith('ship the fix');
    expect(agentLoop).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('daemon completed task');
    expect(logs.join('\n')).toContain('2 tool call');
  });

  it('falls back to local agent loop when daemon path fails', async () => {
    const legacyChat = vi.fn().mockRejectedValue(new Error('daemon not reachable'));

    const { executeTask, agentLoop, daemonConnect, loadConfig } = await loadExecuteTaskWithMocks({
      daemonLegacyChat: legacyChat,
      agentLoopResult: {
        messages: [{ role: 'assistant', content: 'fallback handled task' }],
        toolCallCount: 3,
      },
    });

    await executeTask(['recover', 'from', 'daemon', 'failure'], { format: 'json' });

    expect(daemonConnect).toHaveBeenCalledTimes(1);
    expect(legacyChat).toHaveBeenCalledTimes(1);
    expect(agentLoop).toHaveBeenCalledTimes(1);
    expect(agentLoop).toHaveBeenCalledWith(
      'recover from daemon failure',
      await loadConfig.mock.results[0]?.value,
      { silent: true }
    );

    const parsed = JSON.parse(logs[0] ?? '{}');
    expect(parsed.result).toBe('fallback handled task');
    expect(parsed.tool_calls).toBe(3);
    expect(parsed.model).toBe('test-model');
    expect(parsed.exit_code).toBe(0);
  });

  it('bypasses daemon when --device override is provided', async () => {
    const legacyChat = vi.fn().mockResolvedValue({
      response: 'daemon should not run',
      stats: { toolCalls: 1 },
      model: 'daemon-model',
    });

    const { executeTask, agentLoop, daemonConnect } = await loadExecuteTaskWithMocks({
      daemonLegacyChat: legacyChat,
      agentLoopResult: {
        messages: [{ role: 'assistant', content: 'device-routed response' }],
        toolCallCount: 4,
      },
    });

    await executeTask(['target', 'remote', 'device'], { device: 'mono512:1234' });

    expect(daemonConnect).not.toHaveBeenCalled();
    expect(legacyChat).not.toHaveBeenCalled();
    expect(agentLoop).toHaveBeenCalledTimes(1);
    expect(logs.join('\n')).toContain('device-routed response');
  });
});
