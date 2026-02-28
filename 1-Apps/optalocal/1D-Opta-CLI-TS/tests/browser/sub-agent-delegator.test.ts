import { describe, expect, it, vi, afterEach } from 'vitest';
import { delegateToBrowserSubAgent, type BrowserSubAgentOptions } from '../../src/browser/sub-agent-delegator.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

vi.mock('../../src/core/subagent.js', () => ({
  spawnSubAgent: vi.fn(),
  formatSubAgentResult: vi.fn((r: { response: string }) => r.response),
  createSubAgentContext: vi.fn(() => ({
    parentSessionId: 'root',
    depth: 1,
    budget: { maxToolCalls: 30, maxTokens: 50000, timeoutMs: 60000 },
    parentCwd: '/tmp',
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({ chat: { completions: { create: vi.fn() } } })),
}));

vi.mock('../../src/mcp/registry.js', () => ({
  buildToolRegistry: vi.fn().mockResolvedValue({
    schemas: [],
    execute: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../src/lmx/api-key.js', () => ({
  resolveLmxApiKey: vi.fn().mockReturnValue('test-key'),
}));

import { spawnSubAgent } from '../../src/core/subagent.js';

afterEach(() => vi.clearAllMocks());

describe('BrowserSubAgentDelegator', () => {
  const opts: BrowserSubAgentOptions = {
    goal: 'Navigate to https://example.com and take a screenshot',
    config: DEFAULT_CONFIG,
  };

  const successResult = {
    taskId: 'task-01',
    status: 'completed' as const,
    response: 'Screenshot captured. File: /tmp/ss-001.png',
    toolCallCount: 3,
    tokenEstimate: 1200,
    filesRead: [],
    filesModified: [],
    durationMs: 4500,
  };

  it('spawns a sub-agent with the browser goal and returns a BrowserSubAgentResult', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue(successResult);

    const result = await delegateToBrowserSubAgent(opts);

    expect(spawnSubAgent).toHaveBeenCalledOnce();
    const spawnArgs = vi.mocked(spawnSubAgent).mock.calls[0];
    expect(spawnArgs?.[0]?.description).toContain('Navigate to https://example.com');
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Screenshot captured');
  });

  it('returns ok: false when sub-agent errors', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue({
      ...successResult,
      status: 'error',
      response: 'LMX unreachable',
    });

    const result = await delegateToBrowserSubAgent(opts);

    expect(result.ok).toBe(false);
  });

  it('returns ok: false when sub-agent throws', async () => {
    vi.mocked(spawnSubAgent).mockRejectedValue(new Error('LMX unreachable'));

    const result = await delegateToBrowserSubAgent(opts);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('LMX unreachable');
  });

  it('passes sessionId continuity if preferredSessionId is provided', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue(successResult);

    await delegateToBrowserSubAgent({ ...opts, preferredSessionId: 'sess-reuse-01' });

    const spawnArgs = vi.mocked(spawnSubAgent).mock.calls[0];
    expect(JSON.stringify(spawnArgs)).toContain('sess-reuse-01');
  });
});
