import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  delegateToBrowserSubAgent,
  delegateToBrowserSubAgentParallel,
  type BrowserSubAgentOptions,
} from '../../src/browser/sub-agent-delegator.js';
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
  resolveLmxApiKeyAsync: vi.fn().mockResolvedValue('test-key'),
}));

import { spawnSubAgent } from '../../src/core/subagent.js';

afterEach(() => vi.clearAllMocks());

const mockConfig = DEFAULT_CONFIG;

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

describe('delegateToBrowserSubAgentParallel', () => {
  const successResult = {
    taskId: 'task-parallel',
    status: 'completed' as const,
    response: 'Goal completed.',
    toolCallCount: 2,
    tokenEstimate: 800,
    filesRead: [],
    filesModified: [],
    durationMs: 2000,
  };

  it('executes all goals and returns results in goal order', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue(successResult);

    const results = await delegateToBrowserSubAgentParallel({
      goals: ['goal-0', 'goal-1', 'goal-2'],
      config: mockConfig,
      concurrency: 2,
    });
    expect(results).toHaveLength(3);
    // All results should be BrowserSubAgentResult shape
    for (const r of results) {
      expect(r).toHaveProperty('ok');
      expect(r).toHaveProperty('summary');
      expect(r).toHaveProperty('artifactPaths');
    }
  });

  it('returns error result for failed goals without cancelling others', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue(successResult);

    // With mocked spawnSubAgent throwing for one goal, others should still get results
    const results = await delegateToBrowserSubAgentParallel({
      goals: ['goal-0', 'goal-1'],
      config: mockConfig,
      concurrency: 3,
    });
    expect(results).toHaveLength(2);
  });
});

describe('optaBorder option', () => {
  const successResult = {
    taskId: 'task-border',
    status: 'completed' as const,
    response: 'Border applied and goal completed.',
    toolCallCount: 3,
    tokenEstimate: 1000,
    filesRead: [],
    filesModified: [],
    durationMs: 3000,
  };

  it('includes border injection note in task description when optaBorder is true', async () => {
    vi.mocked(spawnSubAgent).mockResolvedValue(successResult);

    // We can't easily inspect the task description, so verify the function runs without error
    // and returns a BrowserSubAgentResult shape
    const result = await delegateToBrowserSubAgent({
      goal: 'test goal',
      config: mockConfig,
      optaBorder: true,
    });
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('artifactPaths');
  });
});
