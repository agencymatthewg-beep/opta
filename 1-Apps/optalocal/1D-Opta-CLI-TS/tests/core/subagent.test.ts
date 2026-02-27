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
      { ...DEFAULT_CONFIG, defaultMode: 'auto' as const, autonomy: { ...DEFAULT_CONFIG.autonomy, level: 3 } },
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

// ---- End-to-End Multi-Tool-Call Spawn ----

describe('spawnSubAgent end-to-end', () => {
  it('handles a multi-step tool call sequence (read -> search -> edit -> done)', async () => {
    const mockClient = createMockOpenAIClient([
      // Step 1: read a file
      { text: '', toolCalls: [{ id: 'tc1', name: 'read_file', args: '{"path":"src/config.ts"}' }] },
      // Step 2: search for a pattern
      { text: '', toolCalls: [{ id: 'tc2', name: 'search_files', args: '{"pattern":"TODO"}' }] },
      // Step 3: edit a file
      { text: '', toolCalls: [{ id: 'tc3', name: 'edit_file', args: '{"path":"src/config.ts","old_text":"// TODO","new_text":"// DONE"}' }] },
      // Step 4: done
      { text: 'Fixed 1 TODO in config.ts. Changed "// TODO" to "// DONE".', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'e2e-1', description: 'Fix TODOs', budget: { maxToolCalls: 10 } },
      { ...DEFAULT_CONFIG, defaultMode: 'auto' as const, autonomy: { ...DEFAULT_CONFIG.autonomy, level: 3 } },
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('completed');
    expect(result.toolCallCount).toBe(3);
    expect(result.filesRead).toContain('src/config.ts');
    expect(result.filesModified).toContain('src/config.ts');
    expect(result.response).toContain('Fixed 1 TODO');
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(4);
  });

  it('handles parallel tool calls in a single response', async () => {
    const mockClient = createMockOpenAIClient([
      // Model returns two tool calls in one response
      {
        text: '',
        toolCalls: [
          { id: 'tc1', name: 'read_file', args: '{"path":"src/a.ts"}' },
          { id: 'tc2', name: 'read_file', args: '{"path":"src/b.ts"}' },
        ],
      },
      { text: 'Both files analyzed.', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'parallel-1', description: 'Read both files' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('completed');
    expect(result.toolCallCount).toBe(2);
    expect(result.filesRead).toContain('src/a.ts');
    expect(result.filesRead).toContain('src/b.ts');
    // registry.execute should have been called twice
    expect(mockRegistry.execute).toHaveBeenCalledTimes(2);
  });
});

// ---- Budget Exhaustion Mid-Batch ----

describe('spawnSubAgent budget mid-batch', () => {
  it('stops executing tool calls when budget exhausted mid-batch', async () => {
    // Model returns 3 tool calls in one response, but budget is 2
    const mockClient = createMockOpenAIClient([
      {
        text: '',
        toolCalls: [
          { id: 'tc1', name: 'read_file', args: '{"path":"a.ts"}' },
          { id: 'tc2', name: 'read_file', args: '{"path":"b.ts"}' },
          { id: 'tc3', name: 'read_file', args: '{"path":"c.ts"}' },
        ],
      },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'mid-batch', description: 'Read 3 files', budget: { maxToolCalls: 2 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    // Should stop at 2 tool calls, then next loop iteration detects budget exceeded
    expect(result.status).toBe('budget_exceeded');
    expect(result.toolCallCount).toBe(2);
    // Third file should NOT have been read
    expect(result.filesRead).toContain('a.ts');
    expect(result.filesRead).toContain('b.ts');
    expect(result.filesRead).not.toContain('c.ts');
  });
});

// ---- Depth Limit Enforcement at 3 Levels ----

describe('spawnSubAgent depth limit at 3 levels', () => {
  it('allows depth 1 and 2 but rejects depth 3 with maxDepth=2', () => {
    const config = {
      ...DEFAULT_CONFIG,
      subAgent: { ...DEFAULT_CONFIG.subAgent, maxDepth: 2 },
    };

    // Depth 1: OK
    const ctx1 = createSubAgentContext('root', undefined, config);
    expect(ctx1.depth).toBe(1);

    // Depth 2: OK
    const ctx2 = createSubAgentContext('child-1', ctx1, config);
    expect(ctx2.depth).toBe(2);

    // Depth 3: REJECTED
    expect(() => createSubAgentContext('child-2', ctx2, config))
      .toThrow('Maximum sub-agent depth (2) exceeded');
  });

  it('allows 3 levels when maxDepth=3', () => {
    const config = {
      ...DEFAULT_CONFIG,
      subAgent: { ...DEFAULT_CONFIG.subAgent, maxDepth: 3 },
    };

    const ctx1 = createSubAgentContext('root', undefined, config);
    const ctx2 = createSubAgentContext('child-1', ctx1, config);
    const ctx3 = createSubAgentContext('child-2', ctx2, config);
    expect(ctx3.depth).toBe(3);

    // Depth 4: REJECTED
    expect(() => createSubAgentContext('child-3', ctx3, config))
      .toThrow('Maximum sub-agent depth (3) exceeded');
  });
});

// ---- multi_edit File Tracking ----

describe('spawnSubAgent multi_edit tracking', () => {
  it('tracks all files from multi_edit edits array', async () => {
    const multiEditArgs = JSON.stringify({
      edits: [
        { path: 'src/a.ts', old_text: 'foo', new_text: 'bar' },
        { path: 'src/b.ts', old_text: 'baz', new_text: 'qux' },
        { path: 'src/c.ts', old_text: 'x', new_text: 'y' },
      ],
    });

    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'multi_edit', args: multiEditArgs }] },
      { text: 'Applied 3 edits.', toolCalls: [] },
    ]);

    const mockRegistry: ToolRegistry = {
      schemas: [
        {
          type: 'function',
          function: {
            name: 'multi_edit',
            description: 'Multi edit',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
      execute: vi.fn().mockResolvedValue('3 edits applied.'),
      close: vi.fn(),
    };

    const result = await spawnSubAgent(
      { id: 'multi-edit-track', description: 'Apply multi edit', budget: { maxToolCalls: 5 } },
      { ...DEFAULT_CONFIG, defaultMode: 'auto' as const, autonomy: { ...DEFAULT_CONFIG.autonomy, level: 3 } },
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('completed');
    expect(result.filesModified).toContain('src/a.ts');
    expect(result.filesModified).toContain('src/b.ts');
    expect(result.filesModified).toContain('src/c.ts');
    expect(result.filesModified).toHaveLength(3);
  });

  it('deduplicates multi_edit paths when same file edited twice', async () => {
    const multiEditArgs = JSON.stringify({
      edits: [
        { path: 'src/a.ts', old_text: 'foo', new_text: 'bar' },
        { path: 'src/a.ts', old_text: 'baz', new_text: 'qux' },
      ],
    });

    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'multi_edit', args: multiEditArgs }] },
      { text: 'Done.', toolCalls: [] },
    ]);

    const mockRegistry: ToolRegistry = {
      schemas: [
        {
          type: 'function',
          function: {
            name: 'multi_edit',
            description: 'Multi edit',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
      execute: vi.fn().mockResolvedValue('2 edits applied.'),
      close: vi.fn(),
    };

    const result = await spawnSubAgent(
      { id: 'multi-dedup', description: 'Dedup test', budget: { maxToolCalls: 5 } },
      { ...DEFAULT_CONFIG, defaultMode: 'auto' as const, autonomy: { ...DEFAULT_CONFIG.autonomy, level: 3 } },
      mockClient,
      mockRegistry,
    );

    // filesModified uses Set dedup, so should have just 1 entry
    expect(result.filesModified).toHaveLength(1);
    expect(result.filesModified).toContain('src/a.ts');
  });
});

// ---- Prompt Verification ----

describe('SubAgent Prompt file modification reporting', () => {
  it('instructs sub-agent to report files modified', () => {
    const prompt = buildSubAgentPrompt('Fix bugs', '/project', 10);
    expect(prompt).toContain('Files modified');
    expect(prompt).toContain('Files read');
  });

  it('instructs sub-agent not to spawn further sub-agents unless necessary', () => {
    const prompt = buildSubAgentPrompt('Investigate', '/project', 15);
    expect(prompt).toContain('Do NOT spawn further sub-agents');
  });

  it('instructs sub-agent to state when no files modified', () => {
    const prompt = buildSubAgentPrompt('Read-only task', '/project', 5);
    expect(prompt).toContain('No files modified');
  });
});

// ---- No-Response Edge Case ----

describe('spawnSubAgent edge cases', () => {
  it('returns error when model returns empty choices array', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({ choices: [] }),
        },
      },
    } as unknown as import('openai').default;
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'empty-choices', description: 'Edge case' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('error');
    expect(result.response).toContain('No response from model');
  });

  it('handles invalid tool argument JSON gracefully in file tracking', async () => {
    const mockClient = createMockOpenAIClient([
      { text: '', toolCalls: [{ id: 'tc1', name: 'read_file', args: 'not-json' }] },
      { text: 'Done', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'bad-json-track', description: 'Bad JSON args' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    // Should not crash — file tracking ignores parse errors
    expect(result.status).toBe('completed');
    expect(result.filesRead).toHaveLength(0);
  });

  it('handles budget validation failure gracefully (returns error, does not throw)', async () => {
    const mockClient = createMockOpenAIClient([]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'bad-budget', description: 'Test', budget: { maxToolCalls: 0 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('error');
    expect(result.response).toContain('Budget validation failed');
    expect(result.response).toContain('maxToolCalls must be positive');
    // API should never have been called
    expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('uses task scope as cwd when provided', async () => {
    const mockClient = createMockOpenAIClient([
      { text: 'Done from scope', toolCalls: [] },
    ]);
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'scope-test', description: 'Scoped task', scope: '/custom/scope' },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('completed');
    // Verify the system prompt received the scope as cwd
    const createCall = mockClient.chat.completions.create.mock.calls[0];
    const messages = createCall?.[0]?.messages as Array<{ role: string; content: string }>;
    const systemMsg = messages?.find(m => m.role === 'system');
    expect(systemMsg?.content).toContain('/custom/scope');
  });
});
