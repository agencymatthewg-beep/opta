import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_OPTA_API_KEY = process.env['OPTA_API_KEY'];

function restoreOptaApiKey(): void {
  if (ORIGINAL_OPTA_API_KEY === undefined) {
    delete process.env['OPTA_API_KEY'];
    return;
  }
  process.env['OPTA_API_KEY'] = ORIGINAL_OPTA_API_KEY;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  restoreOptaApiKey();
});

describe('runtime keychain fallback callsites', () => {
  it('LmxProvider.getClient uses keychain fallback key when env/config are absent', async () => {
    delete process.env['OPTA_API_KEY'];

    const openAiCtor = vi.fn().mockReturnValue({
      models: { list: vi.fn() },
    });

    vi.doMock('openai', () => ({ default: openAiCtor }));
    vi.doMock('../../src/keychain/api-keys.js', () => ({
      getLmxKey: vi.fn().mockResolvedValue('keychain-provider-key'),
    }));
    vi.doMock('../../src/lmx/endpoints.js', () => ({
      resolveLmxEndpoint: vi.fn().mockResolvedValue({
        host: 'localhost',
        port: 1234,
        source: 'primary',
        state: 'connected',
      }),
    }));

    const { DEFAULT_CONFIG } = await import('../../src/core/config.js');
    const { LmxProvider } = await import('../../src/providers/lmx.js');

    const provider = new LmxProvider({
      ...DEFAULT_CONFIG,
      connection: {
        ...DEFAULT_CONFIG.connection,
        apiKey: undefined,
      },
    });

    await provider.getClient();

    expect(openAiCtor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'keychain-provider-key' }),
    );
  });

  it('buildToolRegistry spawn_agent path uses keychain fallback key', async () => {
    delete process.env['OPTA_API_KEY'];

    const openAiCtor = vi.fn().mockReturnValue({});
    const spawnSubAgent = vi.fn().mockResolvedValue({
      taskId: 'task-1',
      status: 'completed',
      response: 'sub-agent done',
      toolCallCount: 1,
      tokenEstimate: 10,
      filesRead: [],
      filesModified: [],
      durationMs: 1,
    });

    vi.doMock('openai', () => ({ default: openAiCtor }));
    vi.doMock('nanoid', () => ({ nanoid: vi.fn(() => 'agent-1') }));
    vi.doMock('../../src/keychain/api-keys.js', () => ({
      getLmxKey: vi.fn().mockResolvedValue('keychain-registry-key'),
    }));
    vi.doMock('../../src/core/subagent.js', () => ({
      spawnSubAgent,
      formatSubAgentResult: vi.fn((r: { response: string }) => r.response),
      createSubAgentContext: vi.fn(() => ({
        parentSessionId: 'root',
        depth: 1,
        budget: { maxToolCalls: 30, maxTokens: 50_000, timeoutMs: 60_000 },
        parentCwd: process.cwd(),
      })),
    }));

    const { DEFAULT_CONFIG } = await import('../../src/core/config.js');
    const { buildToolRegistry } = await import('../../src/mcp/registry.js');

    const config = {
      ...DEFAULT_CONFIG,
      connection: {
        ...DEFAULT_CONFIG.connection,
        apiKey: undefined,
      },
      model: {
        ...DEFAULT_CONFIG.model,
        default: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
      },
      lsp: {
        ...DEFAULT_CONFIG.lsp,
        enabled: false,
      },
      mcp: {
        ...DEFAULT_CONFIG.mcp,
        servers: {},
      },
    };

    const registry = await buildToolRegistry(config);
    try {
      const result = await registry.execute(
        'spawn_agent',
        JSON.stringify({ task: 'Summarize open files' }),
      );
      expect(result).toContain('sub-agent done');
    } finally {
      await registry.close();
    }

    expect(spawnSubAgent).toHaveBeenCalledOnce();
    expect(openAiCtor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'keychain-registry-key' }),
    );
  });

  it('delegateToBrowserSubAgent uses keychain fallback key', async () => {
    delete process.env['OPTA_API_KEY'];

    const openAiCtor = vi.fn().mockReturnValue({});
    const spawnSubAgent = vi.fn().mockResolvedValue({
      taskId: 'task-browser',
      status: 'completed',
      response: 'browser done',
      toolCallCount: 1,
      tokenEstimate: 10,
      filesRead: [],
      filesModified: [],
      durationMs: 1,
    });
    const closeRegistry = vi.fn().mockResolvedValue(undefined);

    vi.doMock('openai', () => ({ default: openAiCtor }));
    vi.doMock('../../src/keychain/api-keys.js', () => ({
      getLmxKey: vi.fn().mockResolvedValue('keychain-delegator-key'),
    }));
    vi.doMock('../../src/core/subagent.js', () => ({
      spawnSubAgent,
      formatSubAgentResult: vi.fn((r: { response: string }) => r.response),
      createSubAgentContext: vi.fn(() => ({
        parentSessionId: 'root',
        depth: 1,
        budget: { maxToolCalls: 30, maxTokens: 50_000, timeoutMs: 60_000 },
        parentCwd: process.cwd(),
      })),
    }));
    vi.doMock('../../src/mcp/registry.js', () => ({
      buildToolRegistry: vi.fn().mockResolvedValue({
        schemas: [],
        execute: vi.fn(),
        close: closeRegistry,
      }),
    }));

    const { DEFAULT_CONFIG } = await import('../../src/core/config.js');
    const { delegateToBrowserSubAgent } = await import('../../src/browser/sub-agent-delegator.js');

    const result = await delegateToBrowserSubAgent({
      goal: 'Navigate to example.com',
      config: {
        ...DEFAULT_CONFIG,
        connection: {
          ...DEFAULT_CONFIG.connection,
          apiKey: undefined,
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(spawnSubAgent).toHaveBeenCalledOnce();
    expect(closeRegistry).toHaveBeenCalledOnce();
    expect(openAiCtor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'keychain-delegator-key' }),
    );
  });
});
