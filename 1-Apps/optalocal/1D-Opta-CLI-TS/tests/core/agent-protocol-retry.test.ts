import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

const streamingState = vi.hoisted(() => ({
  collectStream: vi.fn(),
  createStreamWithRetry: vi.fn(async () => ({
    async *[Symbol.asyncIterator]() {
      return;
    },
  })),
}));

const toolCompatibilityState = vi.hoisted(() => ({
  readToolCompatibilityEntry: vi.fn(async () => null),
  buildToolCompatibilityInstruction: vi.fn(() => ''),
  recordToolCompatibilityEvent: vi.fn(async () => undefined),
}));

vi.mock('../../src/core/agent-setup.js', () => ({
  getOrCreateClient: vi.fn(async () => ({
    __optaProviderName: 'lmx',
    chat: { completions: { create: vi.fn() } },
  })),
  buildSystemPrompt: vi.fn(async () => 'SYSTEM_PROMPT'),
  compactHistory: vi.fn(async (messages: unknown[]) => messages),
  maskOldObservations: vi.fn((messages: unknown[]) => messages),
  buildCapabilityManifest: vi.fn(() => 'capabilities'),
  injectCapabilityManifest: vi.fn((prompt: string) => prompt),
}));

vi.mock('../../src/core/agent-streaming.js', () => ({
  createStreamWithRetry: (...args: unknown[]) => streamingState.createStreamWithRetry(...args),
  collectStream: (...args: unknown[]) => streamingState.collectStream(...args),
}));

vi.mock('../../src/core/agent-permissions.js', () => ({
  resolveToolDecisions: vi.fn(async () => []),
}));

vi.mock('../../src/core/agent-execution.js', () => ({
  executeToolCalls: vi.fn(async () => ({ toolCallsDelta: 0, checkpointCount: 0 })),
}));

vi.mock('../../src/core/tools/index.js', () => ({
  initProcessManager: vi.fn(),
  shutdownProcessManager: vi.fn(async () => undefined),
}));

vi.mock('../../src/mcp/registry.js', () => ({
  buildToolRegistry: vi.fn(async () => ({
    schemas: [],
    execute: vi.fn(async () => ''),
    close: vi.fn(async () => undefined),
  })),
}));

vi.mock('../../src/hooks/integration.js', () => ({
  createHookManager: vi.fn(() => ({})),
  fireSessionStart: vi.fn(async () => undefined),
  fireSessionEnd: vi.fn(async () => undefined),
  fireCompact: vi.fn(async () => undefined),
  fireError: vi.fn(async () => undefined),
}));

vi.mock('../../src/core/tool-compatibility.js', () => ({
  readToolCompatibilityEntry: (...args: unknown[]) => toolCompatibilityState.readToolCompatibilityEntry(...args),
  buildToolCompatibilityInstruction: (...args: unknown[]) => toolCompatibilityState.buildToolCompatibilityInstruction(...args),
  recordToolCompatibilityEvent: (...args: unknown[]) => toolCompatibilityState.recordToolCompatibilityEvent(...args),
}));

describe('agent protocol retry path', () => {
  beforeEach(() => {
    let collectCount = 0;
    streamingState.collectStream.mockReset();
    streamingState.collectStream.mockImplementation(async () => {
      collectCount += 1;
      if (collectCount === 1) {
        return {
          text: 'run_shell_command command: open -a "Google Chrome"',
          toolCalls: [],
          thinkingRenderer: {},
          usage: null,
          finishReason: null,
        };
      }
      return {
        text: 'Task complete.',
        toolCalls: [],
        thinkingRenderer: {},
        usage: null,
        finishReason: null,
      };
    });
    toolCompatibilityState.recordToolCompatibilityEvent.mockClear();
  });

  it('retries once when pseudo tool directives are detected without tool calls', async () => {
    const { agentLoop } = await import('../../src/core/agent.js');
    const config = structuredClone(DEFAULT_CONFIG);
    config.model.default = 'test-model';
    config.browser.enabled = true;

    const result = await agentLoop('Open the browser and log in.', config, {
      silent: true,
    });

    expect(streamingState.collectStream).toHaveBeenCalledTimes(2);
    expect(result.messages.at(-1)?.role).toBe('assistant');
    expect(result.messages.at(-1)?.content).toBe('Task complete.');
    expect(toolCompatibilityState.recordToolCompatibilityEvent).toHaveBeenCalledWith(
      process.cwd(),
      expect.objectContaining({
        model: config.model.default,
        provider: 'lmx',
        status: 'pseudo_failure',
      }),
    );
  });
});
