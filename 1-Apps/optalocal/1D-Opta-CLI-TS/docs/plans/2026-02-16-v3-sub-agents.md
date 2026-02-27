# Sub-Agent System — Design & TDD Implementation Plan

> **Status:** Design Complete
> **Date:** 2026-02-16
> **Phase:** V3 Phase 3 (per v3-roadmap.md)
> **Goal:** Enable spawning child agent loops with isolated contexts, resource budgets, and hierarchical planning

---

## 1. Architecture Overview

### How Sub-Agents Fit Into the Existing Agent Loop

The current `agentLoop()` in `src/core/agent.ts` is a single-threaded loop: send messages to LMX, parse tool calls, execute tools, feed results back. Sub-agents extend this by making **the agent loop itself callable as a tool**.

When the parent agent calls `spawn_agent`, a new `agentLoop()` is invoked with:
- An **isolated message array** (fresh system prompt + scoped task)
- A **derived config** (inherited permissions, reduced budgets)
- **Silent mode** enabled (no terminal output — results return to parent)
- **No interactive prompts** (all `ask_user` calls denied, `ask` permissions become `deny`)

The child runs to completion (or hits its budget), and the result is injected as a tool response into the parent's message history.

```
Parent Agent Loop
  ├─ ... normal tool calls ...
  ├─ spawn_agent("Search all test files for auth patterns")
  │   └─ Child Agent Loop (isolated messages, silent, budget: 15 tools)
  │       ├─ find_files("**/*.test.ts")
  │       ├─ search_files("auth")
  │       └─ [text response: "Found 3 files..."]
  │   └─ Result injected back to parent as tool result
  ├─ spawn_agent("Read the auth middleware and summarize")
  │   └─ Child Agent Loop (...)
  └─ Parent synthesizes child results → final answer
```

### Key Design Decisions

1. **Isolated message arrays** — Each child gets a fresh `AgentMessage[]`. No shared message bus. Children never see parent history. This prevents context pollution and keeps token usage predictable.

2. **Shared OpenAI client** — Parent creates one `OpenAI` instance. Children receive the same client reference. The LMX server handles concurrent requests; no client-side pooling needed.

3. **Return value communication** — Children return `SubAgentResult` as a serialized string injected into the parent's tool result. No file-based IPC, no message bus.

4. **Sequential execution** — V3 runs children sequentially (matching the existing single-threaded pattern). Parallel execution is a V4 optimization — the design supports it but we don't implement it here.

5. **Tool registry sharing** — Children get the same `ToolRegistry` as the parent (same MCP connections, same built-in tools). But permissions are tightened: children cannot call `ask_user` (they run silently) and inherit or restrict the parent's permission mode.

6. **Budget enforcement** — Children have their own circuit breaker settings derived from the parent's budget allocation. A child hitting its budget is a normal completion, not an error.

---

## 2. New Files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/core/subagent.ts` | SubAgent spawning, budget enforcement, result aggregation | ~200 |
| `src/core/subagent.test.ts` | Unit tests for sub-agent lifecycle | ~250 |
| `src/core/orchestrator.ts` | Hierarchical planning: decompose task into sub-tasks | ~120 |
| `src/core/orchestrator.test.ts` | Unit tests for task decomposition | ~150 |

**Total new code:** ~720 LOC (including tests)

---

## 3. Modified Files

| File | Modification | Lines Affected |
|------|-------------|----------------|
| `src/core/agent.ts` | Extract `agentLoopInternal()` from `agentLoop()` to allow reuse by sub-agents. Add `SubAgentContext` to `AgentLoopOptions`. | Lines 264-500 (refactor into inner function + wrapper) |
| `src/core/tools.ts` | Add `spawn_agent` and `delegate_task` tool schemas + executor stubs | Append ~50 lines after existing schemas |
| `src/core/config.ts` | Add `subAgent` config section to `OptaConfigSchema` | Append ~20 lines to schema |
| `src/mcp/registry.ts` | Add `spawn_agent` and `delegate_task` to `WRITE_TOOL_NAMES` set for plan-mode filtering | Line 66-69 |
| `src/core/context.ts` | Export `COMPACTION_PROMPT` (already exported) — no changes needed | None |

---

## 4. Type Definitions

```typescript
// In src/core/subagent.ts

export interface SubAgentBudget {
  maxToolCalls: number;      // Default: 15 (half of parent's pauseAt)
  maxTokens: number;         // Default: 8192 (quarter of parent's context limit)
  timeoutMs: number;         // Default: 60_000 (1 minute)
}

export interface SubAgentTask {
  id: string;                // nanoid(8)
  description: string;       // What the child should do
  scope?: string;            // Optional: file paths or directories to focus on
  budget?: Partial<SubAgentBudget>;
  tools?: string[];          // Optional: whitelist of allowed tool names
  mode?: string;             // Optional: override permission mode ('plan', 'auto', etc.)
}

export interface SubAgentResult {
  taskId: string;
  status: 'completed' | 'budget_exceeded' | 'timeout' | 'error';
  response: string;          // Final assistant text
  toolCallCount: number;
  tokenEstimate: number;
  filesRead: string[];       // Files the child read (for parent awareness)
  filesModified: string[];   // Files the child modified (for conflict detection)
  durationMs: number;
}

export interface SubAgentContext {
  parentSessionId: string;
  depth: number;             // 0 = root, 1 = child, 2 = grandchild
  budget: SubAgentBudget;
  parentCwd: string;
}
```

---

## 5. Tool Definitions (OpenAI Function Schemas)

### spawn_agent

```typescript
{
  type: 'function',
  function: {
    name: 'spawn_agent',
    description: 'Spawn a sub-agent to perform a focused task independently. The sub-agent has its own context window and returns a result summary. Use for: parallel investigation, focused code search, isolated analysis. Do NOT use for trivial tasks a single tool call can handle.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Clear task description for the sub-agent. Be specific about what files to look at and what to report back.',
        },
        scope: {
          type: 'string',
          description: 'Optional: directory or file path to focus on (relative to cwd)',
        },
        max_tool_calls: {
          type: 'number',
          description: 'Max tool calls the sub-agent can make (default: 15)',
        },
        mode: {
          type: 'string',
          enum: ['plan', 'auto'],
          description: 'Permission mode for sub-agent. "plan" = read-only, "auto" = can edit files.',
        },
      },
      required: ['task'],
    },
  },
}
```

### delegate_task

```typescript
{
  type: 'function',
  function: {
    name: 'delegate_task',
    description: 'Break a complex task into sub-tasks and run them sequentially. Each sub-task spawns a sub-agent. Results are aggregated into a single report. Use for multi-step investigations or when exploring multiple areas of the codebase.',
    parameters: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          description: 'High-level description of the overall goal',
        },
        subtasks: {
          type: 'array',
          description: 'Ordered list of sub-tasks to execute',
          items: {
            type: 'object',
            properties: {
              task: { type: 'string', description: 'Task description' },
              scope: { type: 'string', description: 'Focus directory/file' },
              depends_on: { type: 'number', description: 'Index of prerequisite sub-task (0-based)' },
            },
            required: ['task'],
          },
        },
      },
      required: ['plan', 'subtasks'],
    },
  },
}
```

---

## 6. Config Schema Additions

```typescript
// Appended to OptaConfigSchema in src/core/config.ts

subAgent: z
  .object({
    enabled: z.boolean().default(true),
    maxDepth: z.number().default(2),           // Max nesting: parent → child → grandchild
    maxConcurrent: z.number().default(1),      // V3: always 1 (sequential). V4: configurable
    defaultBudget: z
      .object({
        maxToolCalls: z.number().default(15),
        maxTokens: z.number().default(8192),
        timeoutMs: z.number().default(60_000),
      })
      .default({}),
    inheritMode: z.boolean().default(true),    // Children inherit parent permission mode
  })
  .default({}),
```

---

## 7. Implementation Tasks (TDD)

### Task 1: SubAgentBudget Validation & Defaults

**Test file:** `src/core/subagent.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBudget, validateBudget } from './subagent.js';
import { DEFAULT_CONFIG } from './config.js';

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
    expect(() => validateBudget({ maxToolCalls: 0, maxTokens: 100, timeoutMs: 1000 }))
      .toThrow('maxToolCalls must be positive');
  });

  it('rejects timeout below 5 seconds', () => {
    expect(() => validateBudget({ maxToolCalls: 10, maxTokens: 100, timeoutMs: 1000 }))
      .toThrow('timeoutMs must be at least 5000');
  });
});
```

**Implementation:**
1. Create `src/core/subagent.ts`
2. Implement `resolveBudget(overrides, config) → SubAgentBudget`
3. Implement `validateBudget(budget) → void | throw`
4. Budget clamping: `maxToolCalls <= config.safety.circuitBreaker.hardStopAt`

---

### Task 2: SubAgent Context & Depth Tracking

```typescript
describe('SubAgent Context', () => {
  it('creates context with depth 1 for first child', () => {
    const ctx = createSubAgentContext('parent-session-123', undefined);
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
    const childCtx = createSubAgentContext('session-2', parentCtx);
    expect(childCtx.depth).toBe(2);
  });

  it('rejects spawn when maxDepth exceeded', () => {
    const ctx: SubAgentContext = {
      parentSessionId: 'session-1',
      depth: 2,
      budget: resolveBudget({}, DEFAULT_CONFIG),
      parentCwd: '/test',
    };
    const config = { ...DEFAULT_CONFIG, subAgent: { ...DEFAULT_CONFIG.subAgent, maxDepth: 2 } };
    expect(() => createSubAgentContext('session-3', ctx, config))
      .toThrow('Maximum sub-agent depth (2) exceeded');
  });
});
```

**Implementation:**
1. Implement `createSubAgentContext(sessionId, parentContext?, config?) → SubAgentContext`
2. Depth check: `parentContext.depth + 1 > config.subAgent.maxDepth` throws

---

### Task 3: SubAgent System Prompt Generation

```typescript
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
```

**Implementation:**
1. Implement `buildSubAgentPrompt(task, cwd, maxToolCalls) → string`
2. Template: focused task description + budget awareness + conciseness instruction
3. No OPIS loading, no export map — children are lightweight and fast

---

### Task 4: Permission Derivation for Children

```typescript
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
    const parentConfig = { ...DEFAULT_CONFIG, git: { autoCommit: true, checkpoints: true } };
    const derived = deriveChildConfig(parentConfig);
    expect(derived.git.autoCommit).toBe(false);
    expect(derived.git.checkpoints).toBe(false);
  });

  it('applies child circuit breaker from budget', () => {
    const derived = deriveChildConfig(DEFAULT_CONFIG, undefined, { maxToolCalls: 10, maxTokens: 4096, timeoutMs: 30_000 });
    expect(derived.safety.circuitBreaker.hardStopAt).toBe(10);
    expect(derived.safety.circuitBreaker.pauseAt).toBe(0); // No pause for silent agents
    expect(derived.safety.circuitBreaker.warnAt).toBe(0);
  });
});
```

**Implementation:**
1. Implement `deriveChildConfig(parentConfig, modeOverride?, budget?) → OptaConfig`
2. Always set `ask_user: 'deny'`, `git.autoCommit: false`, `git.checkpoints: false`
3. Map budget into circuit breaker: `hardStopAt = budget.maxToolCalls`, `pauseAt = 0`, `warnAt = 0`

---

### Task 5: Core spawnSubAgent Function

```typescript
import { vi } from 'vitest';

describe('spawnSubAgent', () => {
  it('runs child agent loop to completion and returns result', async () => {
    const mockClient = createMockOpenAIClient([
      // Child sends one search, then responds with text
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
    // Mock client that always returns tool calls (never finishes)
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
    const mockClient = createSlowMockClient(5000); // 5s per call
    const mockRegistry = createMockRegistry();

    const result = await spawnSubAgent(
      { id: 'task3', description: 'Slow task', budget: { timeoutMs: 100 } },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
    );

    expect(result.status).toBe('timeout');
  });

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
});
```

**Implementation:**
1. Implement `spawnSubAgent(task, config, client, registry) → Promise<SubAgentResult>`
2. Build child system prompt via `buildSubAgentPrompt()`
3. Derive child config via `deriveChildConfig()`
4. Run a simplified agent loop (inline, not calling `agentLoop()` directly — avoids the outer wrapper's session/commit logic)
5. Wrap execution in `Promise.race` with timeout
6. Track `filesRead` / `filesModified` by inspecting tool call arguments
7. Return `SubAgentResult` with all metrics

---

### Task 6: Tool Executor for spawn_agent

```typescript
describe('spawn_agent tool executor', () => {
  it('parses task from args and calls spawnSubAgent', async () => {
    const spy = vi.spyOn(subagentModule, 'spawnSubAgent');
    spy.mockResolvedValue({
      taskId: 'test',
      status: 'completed',
      response: 'Found the bug',
      toolCallCount: 3,
      tokenEstimate: 500,
      filesRead: ['src/auth.ts'],
      filesModified: [],
      durationMs: 1200,
    });

    const result = await execSpawnAgent({
      task: 'Find the auth bug',
      max_tool_calls: 10,
    });

    expect(result).toContain('Found the bug');
    expect(result).toContain('3 tool calls');
    expect(result).toContain('1.2s');
  });

  it('formats error result clearly', async () => {
    const spy = vi.spyOn(subagentModule, 'spawnSubAgent');
    spy.mockResolvedValue({
      taskId: 'test',
      status: 'error',
      response: 'Connection refused',
      toolCallCount: 0,
      tokenEstimate: 0,
      filesRead: [],
      filesModified: [],
      durationMs: 50,
    });

    const result = await execSpawnAgent({ task: 'Failing task' });
    expect(result).toContain('Error');
    expect(result).toContain('Connection refused');
  });
});
```

**Implementation:**
1. Add `execSpawnAgent(args)` to `src/core/tools.ts`
2. Parse args, validate task string is non-empty
3. Call `spawnSubAgent()` with derived parameters
4. Format `SubAgentResult` into a readable string for the parent agent

---

### Task 7: delegate_task Tool (Orchestrator)

```typescript
// src/core/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('delegate_task orchestrator', () => {
  it('executes subtasks sequentially', async () => {
    const spawnSpy = vi.fn()
      .mockResolvedValueOnce(makeResult('task-0', 'Found 5 files'))
      .mockResolvedValueOnce(makeResult('task-1', 'Auth uses JWT'));

    const result = await executeDelegation(
      {
        plan: 'Understand the auth system',
        subtasks: [
          { task: 'Find all auth-related files' },
          { task: 'Summarize the auth middleware' },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(result).toContain('Found 5 files');
    expect(result).toContain('Auth uses JWT');
  });

  it('injects previous subtask results into next subtask context', async () => {
    const spawnSpy = vi.fn()
      .mockResolvedValueOnce(makeResult('task-0', 'File list: a.ts, b.ts'))
      .mockResolvedValueOnce(makeResult('task-1', 'Analyzed'));

    await executeDelegation(
      {
        plan: 'Multi-step',
        subtasks: [
          { task: 'List files' },
          { task: 'Analyze files', depends_on: 0 },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    // Second call should include first result in task description
    const secondCall = spawnSpy.mock.calls[1]![0];
    expect(secondCall.description).toContain('File list: a.ts, b.ts');
  });

  it('stops on subtask error when stopOnError is true', async () => {
    const spawnSpy = vi.fn()
      .mockResolvedValueOnce(makeResult('task-0', '', 'error'))
      .mockResolvedValueOnce(makeResult('task-1', 'Should not reach'));

    const result = await executeDelegation(
      {
        plan: 'Failing plan',
        subtasks: [
          { task: 'Failing step' },
          { task: 'Next step' },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(result).toContain('error');
  });

  it('limits total subtasks to 5', async () => {
    const subtasks = Array(8).fill({ task: 'Do something' });
    await expect(executeDelegation(
      { plan: 'Too many', subtasks },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      vi.fn(),
    )).rejects.toThrow('Maximum 5 subtasks');
  });
});
```

**Implementation:**
1. Create `src/core/orchestrator.ts`
2. Implement `executeDelegation(plan, config, client, registry, spawnFn) → string`
3. Iterate subtasks sequentially, inject prior results for `depends_on` references
4. Aggregate all results into a formatted summary string
5. Hard limit: 5 subtasks per delegation (prevents runaway decomposition)

---

### Task 8: Agent Loop Refactoring

```typescript
// Tests that existing agent loop still works after refactor
describe('agentLoop (post-refactor)', () => {
  it('produces same result as before for single-turn task', async () => {
    // Ensure agentLoop() still works as the public API
    // This is a regression test — the refactoring should not change behavior
    const mockClient = createMockOpenAIClient([
      { text: 'Hello!', toolCalls: [] },
    ]);

    const result = await agentLoop('Say hello', DEFAULT_CONFIG, {
      silent: true,
    });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.toolCallCount).toBe(0);
  });

  it('supports subAgentContext in options', async () => {
    const result = await agentLoop('Child task', DEFAULT_CONFIG, {
      silent: true,
      subAgentContext: {
        parentSessionId: 'parent-123',
        depth: 1,
        budget: { maxToolCalls: 5, maxTokens: 4096, timeoutMs: 30_000 },
        parentCwd: '/test',
      },
    });

    // Should respect the budget
    expect(result.toolCallCount).toBeLessThanOrEqual(5);
  });
});
```

**Implementation:**
1. Add `subAgentContext?: SubAgentContext` to `AgentLoopOptions`
2. When `subAgentContext` is present:
   - Skip OPIS/export map loading (already omitted from child system prompt)
   - Use budget-derived circuit breaker instead of config's circuit breaker
   - Skip auto-commit logic
   - Skip interactive prompts (all `ask` → `deny`)
3. The `agentLoop()` function signature does NOT change — it gains an optional field

---

### Task 9: Integration with Tool Registry

```typescript
describe('Tool Registry with Sub-Agent Tools', () => {
  it('includes spawn_agent in normal mode', async () => {
    const registry = await buildToolRegistry(
      { ...DEFAULT_CONFIG, subAgent: { ...DEFAULT_CONFIG.subAgent, enabled: true } },
      'normal'
    );
    const names = registry.schemas.map(s => s.function.name);
    expect(names).toContain('spawn_agent');
    expect(names).toContain('delegate_task');
  });

  it('excludes spawn_agent in plan mode', async () => {
    const registry = await buildToolRegistry(DEFAULT_CONFIG, 'plan');
    const names = registry.schemas.map(s => s.function.name);
    expect(names).not.toContain('spawn_agent');
    expect(names).not.toContain('delegate_task');
  });

  it('excludes sub-agent tools when disabled in config', async () => {
    const config = { ...DEFAULT_CONFIG, subAgent: { ...DEFAULT_CONFIG.subAgent, enabled: false } };
    const registry = await buildToolRegistry(config, 'normal');
    const names = registry.schemas.map(s => s.function.name);
    expect(names).not.toContain('spawn_agent');
  });
});
```

**Implementation:**
1. In `buildToolRegistry()`, conditionally include sub-agent tool schemas
2. Add `spawn_agent` and `delegate_task` to `WRITE_TOOL_NAMES` (filtered in plan mode)
3. Route tool execution: `spawn_agent` → `execSpawnAgent()`, `delegate_task` → `execDelegateTask()`

---

## 8. Integration Points

### Circuit Breaker

- Parent's tool call count **includes** the `spawn_agent` call itself (1 call) but NOT the child's internal tool calls
- This prevents sub-agent usage from rapidly exhausting the parent's budget
- Each child has its own independent circuit breaker derived from its budget
- A child hitting `hardStopAt` returns `status: 'budget_exceeded'` — this is not an error from the parent's perspective

### Permissions

- Children inherit the parent's permission mode unless overridden in the task
- `ask_user` is always `deny` for children (they run silently)
- `ask` permissions in the parent become `allow` in children when the parent is in `auto` or `dangerous` mode, and `deny` otherwise
- `plan` mode children: all write tools denied, same as parent plan mode

### Sessions

- Children do NOT create their own session files (no session persistence overhead)
- The parent's session records sub-agent calls as tool results (normal tool result messages)
- Sub-agent results are saved as part of the parent's session via the existing `saveSession()` flow
- No separate session store needed for V3

### Context Compaction

- Children have small contexts (default 8K tokens), so compaction is rare
- If a child's context grows large enough, it uses the same `compactHistory()` mechanism
- The `maskOldObservations()` function applies to children identically

### MCP Servers

- Children share the parent's MCP connections (same `ToolRegistry` instance)
- MCP tools are available to children unless filtered by the `tools` whitelist
- MCP connections are NOT duplicated — single connection set

---

## 9. Risk Mitigation

### Risk 1: Runaway Token Usage
**Problem:** Sub-agents consume tokens against the same LMX server. Multiple children could saturate the server.
**Mitigation:** V3 is sequential-only (maxConcurrent = 1). Budget defaults are conservative (15 tool calls, 8K tokens). Hard limit of 5 subtasks per delegation.

### Risk 2: Infinite Recursion
**Problem:** A child could call `spawn_agent`, spawning a grandchild, spawning a great-grandchild...
**Mitigation:** `maxDepth` config (default 2). Depth is tracked in `SubAgentContext` and checked before spawning. At depth >= maxDepth, `spawn_agent` returns an error string instead of spawning.

### Risk 3: File Conflicts
**Problem:** A child modifies a file that the parent later modifies differently.
**Mitigation:** `SubAgentResult.filesModified` tracks all modified files. The parent sees this list in the tool result. For V3, this is informational — the parent is responsible for conflict awareness. V4 could add automatic conflict detection.

### Risk 4: Timeout Leaks
**Problem:** A child's timeout races with the parent's overall execution.
**Mitigation:** `Promise.race([childExecution, timeoutPromise])`. On timeout, the child loop is abandoned (JS garbage-collects the unreferenced promises). The result returns `status: 'timeout'` with whatever partial work was done.

### Risk 5: Local LLM Tool Call Quality
**Problem:** Local LLMs may generate malformed `spawn_agent` calls (bad JSON, wrong field names). This is more likely than with cloud models.
**Mitigation:** Robust argument parsing with defaults. If `task` is missing or empty, return an immediate error string. The tool description is kept concise to minimize schema token overhead (~300 tokens for both new tools).

### Risk 6: Silent Failure Masking
**Problem:** A child fails silently and the parent proceeds with incomplete information.
**Mitigation:** The formatted result string always includes the `status` field prominently. Error results are prefixed with `[ERROR]` and include the failure reason. The parent sees the full status in its tool result.

---

## 10. Implementation Order

Execute tasks in this order (each depends on the previous):

1. **Task 1** — Budget validation (standalone, no dependencies)
2. **Task 2** — Context & depth tracking (uses budget from Task 1)
3. **Task 3** — System prompt generation (standalone)
4. **Task 4** — Permission derivation (uses config schema)
5. **Task 6 (config)** — Add `subAgent` section to config schema
6. **Task 5** — Core `spawnSubAgent()` (depends on Tasks 1-4)
7. **Task 6 (executor)** — Tool executor wiring
8. **Task 7** — Orchestrator / `delegate_task`
9. **Task 8** — Agent loop refactoring (add `subAgentContext` to options)
10. **Task 9** — Registry integration (wire tools into registry)

**Estimated total effort:** 4-6 hours for an implementing agent following this plan.

---

## 11. Future (V4) Extensions

These are explicitly NOT in V3 but the design supports them:

- **Parallel execution:** Change `maxConcurrent` to > 1. Use `p-queue` (already a dependency) to run children in parallel with concurrency control.
- **Streaming results:** Children stream partial results to parent via an EventEmitter instead of waiting for full completion.
- **Shared context injection:** Parent can inject specific messages or file contents into child's initial context.
- **Result caching:** Identical sub-agent tasks return cached results within the same session.
- **Visual progress:** Show a tree of running sub-agents in the terminal with spinner states.
