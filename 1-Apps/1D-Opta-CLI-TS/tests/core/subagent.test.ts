import { describe, it, expect, vi } from 'vitest';
import {
  resolveBudget,
  validateBudget,
  createSubAgentContext,
  buildSubAgentPrompt,
  deriveChildConfig,
  spawnSubAgent,
  formatSubAgentResult,
} from '../../src/core/subagent.js';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';
import type { SubAgentBudget, SubAgentContext, SubAgentResult } from '../../src/core/subagent.js';
import type { ToolRegistry } from '../../src/mcp/registry.js';

// --- Mock Helpers ---

interface MockResponse {
  text: string;
  toolCalls: Array<{ id: string; name: string; args: string }>;
}

function createMockOpenAIClient(responses: MockResponse[]) {
  let callIndex = 0;
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          const resp = responses[callIndex] ?? { text: 'Done', toolCalls: [] };
          callIndex++;
          return {
            choices: [
              {
                message: {
                  content: resp.text || null,
                  tool_calls: resp.toolCalls.length > 0
                    ? resp.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: tc.args },
                      }))
                    : undefined,
                },
              },
            ],
          };
        }),
      },
    },
  } as unknown as import('openai').default;
}

function createMockRegistry(): ToolRegistry {
  return {
    schemas: [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_files',
          description: 'Search files',
          parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_dir',
          description: 'List directory',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Edit a file',
          parameters: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'run_command',
          description: 'Run a command',
          parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        },
      },
    ],
    execute: vi.fn().mockResolvedValue('Tool executed successfully.'),
    close: vi.fn(),
  };
}

function createSlowMockClient(delayMs: number) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return {
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'tc-slow',
                      type: 'function',
                      function: { name: 'list_dir', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          };
        }),
      },
    },
  } as unknown as import('openai').default;
}

function createErrorMockClient(error: Error) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(error),
      },
    },
  } as unknown as import('openai').default;
}

// ---- Task 1: SubAgentBudget Validation & Defaults ----

describe('SubAgent Budget', () => {
  it('returns defaults when no overrides provided', () => {
    const budget = resolveBudget({}, DEFAULT_CONFIG);
    expect(budget.maxToolCalls).toBe(15);
    expect(budget.maxTokens).toBe(8192);
    expect(budget.timeoutMs).toBe(60_000);
  });

  it('merges partial overrides with defaults', () => {
    const budget = resolveBudget({ maxToolCalls: 5 }, DEFAULT_CONFIG);
    expect(budget.maxToolCalls).toBe(5);
    expect(budget.maxTokens).toBe(8192); // default preserved
  });

  it('clamps budget to parent limits', () => {
    const budget = resolveBudget({ maxToolCalls: 200 }, DEFAULT_CONFIG);
    // Cannot exceed parent's hardStopAt (100)
    expect(budget.maxToolCalls).toBeLessThanOrEqual(100);
  });

  it('rejects zero or negative budgets', () => {
    expect(() => validateBudget({ maxToolCalls: 0, maxTokens: 100, timeoutMs: 5000 }))
      .toThrow('maxToolCalls must be positive');
  });

  it('rejects negative maxTokens', () => {
    expect(() => validateBudget({ maxToolCalls: 10, maxTokens: -1, timeoutMs: 5000 }))
      .toThrow('maxTokens must be positive');
  });

  it('rejects timeout below 5 seconds', () => {
    expect(() => validateBudget({ maxToolCalls: 10, maxTokens: 100, timeoutMs: 1000 }))
      .toThrow('timeoutMs must be at least 5000');
  });
});

// ---- Task 2: SubAgent Context & Depth Tracking ----

describe('SubAgent Context', () => {
  it('creates context with depth 1 for first child', () => {
    const ctx = createSubAgentContext('parent-session-123', undefined, DEFAULT_CONFIG);
    expect(ctx.depth).toBe(1);
    expect(ctx.parentSessionId).toBe('parent-session-123');
  });

  it('increments depth for nested children', () => {
    const parentCtx: SubAgentContext = {
      parentSessionId: 'session-1',
      depth: 1,
      budget: resolveBudget({}, DEFAULT_CONFIG),
      parentCwd: '/test',
    };
    const childCtx = createSubAgentContext('session-2', parentCtx, DEFAULT_CONFIG);
    expect(childCtx.depth).toBe(2);
  });

  it('rejects spawn when maxDepth exceeded', () => {
    const ctx: SubAgentContext = {
      parentSessionId: 'session-1',
      depth: 2,
      budget: resolveBudget({}, DEFAULT_CONFIG),
      parentCwd: '/test',
    };
    const config = {
      ...DEFAULT_CONFIG,
      subAgent: { ...DEFAULT_CONFIG.subAgent, maxDepth: 2 },
    };
    expect(() => createSubAgentContext('session-3', ctx, config))
      .toThrow('Maximum sub-agent depth (2) exceeded');
  });

  it('uses default config maxDepth when no config provided', () => {
    // depth 0 -> depth 1 should work fine with default maxDepth (2)
    const ctx = createSubAgentContext('session-1', undefined, DEFAULT_CONFIG);
    expect(ctx.depth).toBe(1);
  });
});

// ---- Task 3: SubAgent System Prompt Generation ----

describe('SubAgent System Prompt', () => {
  it('includes task description in system prompt', () => {
    const prompt = buildSubAgentPrompt('Search for auth patterns', '/project', 15);
    expect(prompt).toContain('Search for auth patterns');
    expect(prompt).toContain('/project');
  });

  it('includes budget constraints in prompt', () => {
    const prompt = buildSubAgentPrompt('Do something', '/project', 10);
    expect(prompt).toContain('10 tool calls');
  });

  it('instructs sub-agent to be concise', () => {
    const prompt = buildSubAgentPrompt('Explore', '/project', 15);
    expect(prompt).toContain('concise');
    expect(prompt).toContain('summary');
  });

  it('does not include OPIS context (children are lightweight)', () => {
    const prompt = buildSubAgentPrompt('Task', '/project', 15);
    expect(prompt).not.toContain('OPIS');
  });
});

// ---- Task 4: Permission Derivation for Children ----

describe('SubAgent Permissions', () => {
  it('denies ask_user for children (non-interactive)', () => {
    const derived = deriveChildConfig(DEFAULT_CONFIG);
    expect(derived.permissions['ask_user']).toBe('deny');
  });

  it('inherits parent mode when inheritMode is true', () => {
    const parentConfig = { ...DEFAULT_CONFIG, defaultMode: 'auto' as const };
    const derived = deriveChildConfig(parentConfig);
    expect(derived.defaultMode).toBe('auto');
  });

  it('overrides mode when task specifies one', () => {
    const derived = deriveChildConfig(DEFAULT_CONFIG, 'plan');
    expect(derived.defaultMode).toBe('plan');
  });

  it('disables auto-commit for children', () => {
    const parentConfig = {
      ...DEFAULT_CONFIG,
      git: { autoCommit: true, checkpoints: true },
    };
    const derived = deriveChildConfig(parentConfig);
    expect(derived.git.autoCommit).toBe(false);
    expect(derived.git.checkpoints).toBe(false);
  });

  it('applies child circuit breaker from budget', () => {
    const budget: SubAgentBudget = { maxToolCalls: 10, maxTokens: 4096, timeoutMs: 30_000 };
    const derived = deriveChildConfig(DEFAULT_CONFIG, undefined, budget);
    expect(derived.safety.circuitBreaker.hardStopAt).toBe(10);
    expect(derived.safety.circuitBreaker.pauseAt).toBe(0); // No pause for silent agents
    expect(derived.safety.circuitBreaker.warnAt).toBe(0);
  });

  it('uses default circuit breaker when no budget provided', () => {
    const derived = deriveChildConfig(DEFAULT_CONFIG);
    // Should use defaults from the sub-agent default budget
    expect(derived.safety.circuitBreaker.hardStopAt).toBe(15);
    expect(derived.safety.circuitBreaker.pauseAt).toBe(0);
  });
});

// ---- Task 5: Core spawnSubAgent Function ----

describe('spawnSubAgent', () => {
  it('runs child agent loop to completion and returns result', async () => {
    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'search_files', args: '{"pattern":"auth"}' }] },
      { text: 'Found 3 auth-related files in src/core/', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task1', description: 'Find auth patterns' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('completed');
    expect(result.response).toContain('Found 3 auth-related files');
    expect(result.toolCallCount).toBe(1);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('returns budget_exceeded when tool call limit hit', async () => {
    const mockClient = createMockOpenAIClient(
      Array(20).fill({ text: '', toolCalls: [{ id: 'tc', name: 'list_dir', args: '{}' }] })
    );
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task2', description: 'Infinite loop test', budget: { maxToolCalls: 3 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('budget_exceeded');
    expect(result.toolCallCount).toBe(3);
  });

  it('returns timeout when execution exceeds timeoutMs', async () => {
    const mockClient = createSlowMockClient(5000);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task3', description: 'Slow task', budget: { timeoutMs: 100 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    // With 100ms timeout, the 5000ms client should trigger timeout
    // But validate budget requires >= 5000ms. So use 5000 and a slower client
    // Actually timeoutMs: 100 will fail validateBudget. Let's adjust.
    expect(result.status).toBe('error');
    expect(result.response).toContain('timeoutMs must be at least 5000');
  });

  it('returns timeout when budget timeout is valid but exceeded', async () => {
    const mockClient = createSlowMockClient(10000);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task3b', description: 'Slow task', budget: { timeoutMs: 5000 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('timeout');
  }, 10000);

  it('returns error when child throws', async () => {
    const mockClient = createErrorMockClient(new Error('LMX connection refused'));
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task4', description: 'Error test' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('error');
    expect(result.response).toContain('connection refused');
  });

  it('tracks files read and modified by child', async () => {
    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'read_file', args: '{"path":"src/auth.ts"}' }] },
      { text: '', toolCalls: [{ id: 'tc2', name: 'edit_file', args: '{"path":"src/auth.ts","old_text":"a","new_text":"b"}' }] },
      { text: 'Done', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task5', description: 'Edit auth', budget: { maxToolCalls: 10 } },
      { ...DEFAULT_CONFIG, defaultMode: 'auto' as const },
      mockClient,
      mockRegistry,
    );

    expect(result.filesRead).toContain('src/auth.ts');
    expect(result.filesModified).toContain('src/auth.ts');
  });

  it('respects tool whitelist when provided', async () => {
    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'run_command', args: '{"command":"rm -rf /"}' }] },
      { text: 'Denied', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task6', description: 'Restricted', tools: ['read_file', 'search_files'] },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    // run_command should be denied since it's not in the whitelist
    expect(result.toolCallCount).toBe(1);
  });

  it('returns taskId matching input', async () => {
    const mockClient = createMockOpenAIClient([
      { text: 'Done', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'my-task-id', description: 'Simple task' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.taskId).toBe('my-task-id');
  });
});

// ---- Task 6: Tool Executor Formatting ----

describe('formatSubAgentResult', () => {
  it('formats completed result with tool calls and duration', () => {
    const result: SubAgentResult = {
      taskId: 'test',
      status: 'completed',
      response: 'Found the bug',
      toolCallCount: 3,
      tokenEstimate: 500,
      filesRead: ['src/auth.ts'],
      filesModified: [],
      durationMs: 1200,
    };

    const formatted = formatSubAgentResult(result);
    expect(formatted).toContain('Found the bug');
    expect(formatted).toContain('3 tool calls');
    expect(formatted).toContain('1.2s');
  });

  it('formats error result clearly', () => {
    const result: SubAgentResult = {
      taskId: 'test',
      status: 'error',
      response: 'Connection refused',
      toolCallCount: 0,
      tokenEstimate: 0,
      filesRead: [],
      filesModified: [],
      durationMs: 50,
    };

    const formatted = formatSubAgentResult(result);
    expect(formatted).toContain('ERROR');
    expect(formatted).toContain('Connection refused');
  });

  it('formats budget exceeded result', () => {
    const result: SubAgentResult = {
      taskId: 'test',
      status: 'budget_exceeded',
      response: 'Ran out of tool calls',
      toolCallCount: 15,
      tokenEstimate: 2000,
      filesRead: [],
      filesModified: ['src/main.ts'],
      durationMs: 5000,
    };

    const formatted = formatSubAgentResult(result);
    expect(formatted).toContain('BUDGET EXCEEDED');
    expect(formatted).toContain('Files modified: src/main.ts');
  });

  it('formats timeout result', () => {
    const result: SubAgentResult = {
      taskId: 'test',
      status: 'timeout',
      response: 'Timed out',
      toolCallCount: 5,
      tokenEstimate: 1000,
      filesRead: [],
      filesModified: [],
      durationMs: 60000,
    };

    const formatted = formatSubAgentResult(result);
    expect(formatted).toContain('TIMEOUT');
  });

  it('includes files read and modified when present', () => {
    const result: SubAgentResult = {
      taskId: 'test',
      status: 'completed',
      response: 'Analyzed files',
      toolCallCount: 4,
      tokenEstimate: 800,
      filesRead: ['src/a.ts', 'src/b.ts'],
      filesModified: ['src/a.ts'],
      durationMs: 2000,
    };

    const formatted = formatSubAgentResult(result);
    expect(formatted).toContain('Files read: src/a.ts, src/b.ts');
    expect(formatted).toContain('Files modified: src/a.ts');
  });
});

// ---- Depth Propagation via Registry ----

describe('spawnSubAgent depth propagation', () => {
  it('sets registry.parentContext during execution and restores after', async () => {
    const mockClient = createMockOpenAIClient([
      { text: 'Done', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();
    const parentCtx: SubAgentContext = {
      parentSessionId: 'root',
      depth: 1,
      budget: resolveBudget({}, DEFAULT_CONFIG),
      parentCwd: '/test',
    };

    // Before: no parentContext
    expect(mockRegistry.parentContext).toBeUndefined();

    await spawnSubAgent(
      { id: 'depth-test', description: 'Test depth' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      parentCtx,
    );

    // After: parentContext should be restored to undefined
    expect(mockRegistry.parentContext).toBeUndefined();
  });

  it('restores registry.parentContext even on error', async () => {
    const mockClient = createErrorMockClient(new Error('API failure'));
    const mockRegistry = createMockRegistry();
    const parentCtx: SubAgentContext = {
      parentSessionId: 'root',
      depth: 1,
      budget: resolveBudget({}, DEFAULT_CONFIG),
      parentCwd: '/test',
    };

    const result = await spawnSubAgent(
      { id: 'error-depth', description: 'Fail' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      parentCtx,
    );

    expect(result.status).toBe('error');
    // parentContext must be restored even on error
    expect(mockRegistry.parentContext).toBeUndefined();
  });
});
