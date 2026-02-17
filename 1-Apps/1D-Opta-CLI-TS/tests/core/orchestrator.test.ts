import { describe, it, expect, vi } from 'vitest';
import { executeDelegation } from '../../src/core/orchestrator.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import type { SubAgentResult, SubAgentTask } from '../../src/core/subagent.js';
import type { ToolRegistry } from '../../src/mcp/registry.js';

// --- Mock Helpers ---

function makeResult(
  taskId: string,
  response: string,
  status: SubAgentResult['status'] = 'completed'
): SubAgentResult {
  return {
    taskId,
    status,
    response,
    toolCallCount: 2,
    tokenEstimate: 200,
    filesRead: [],
    filesModified: [],
    durationMs: 500,
  };
}

const mockClient = {} as import('openai').default;
const mockRegistry: ToolRegistry = {
  schemas: [],
  execute: vi.fn(),
  close: vi.fn(),
};

describe('delegate_task orchestrator', () => {
  it('executes subtasks sequentially', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
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
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
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
    const secondCall = spawnSpy.mock.calls[1]![0] as SubAgentTask;
    expect(secondCall.description).toContain('File list: a.ts, b.ts');
  });

  it('stops on subtask error when stopOnError is true', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Failed', 'error'))
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

  it('handles empty subtasks array', async () => {
    const result = await executeDelegation(
      { plan: 'No subtasks', subtasks: [] },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      vi.fn(),
    );

    expect(result).toContain('No subtasks');
  });

  it('includes plan description in output', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Done'));

    const result = await executeDelegation(
      {
        plan: 'Investigate auth system',
        subtasks: [{ task: 'Check auth' }],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    expect(result).toContain('Investigate auth system');
  });

  it('passes scope through to subtasks', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Found it'));

    await executeDelegation(
      {
        plan: 'Scoped plan',
        subtasks: [{ task: 'Search in core', scope: 'src/core' }],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    const firstCall = spawnSpy.mock.calls[0]![0] as SubAgentTask;
    expect(firstCall.scope).toBe('src/core');
  });

  it('warns on forward reference depends_on and ignores it', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Done first'))
      .mockResolvedValueOnce(makeResult('task-1', 'Done second'));

    const result = await executeDelegation(
      {
        plan: 'Forward ref plan',
        subtasks: [
          { task: 'First task', depends_on: 1 },  // Forward reference: invalid
          { task: 'Second task' },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    // Should warn about invalid depends_on
    expect(result).toContain('Warning');
    expect(result).toContain('invalid depends_on=1');
    // Both tasks should still execute
    expect(spawnSpy).toHaveBeenCalledTimes(2);
    // First task should NOT have dependency context injected
    const firstCall = spawnSpy.mock.calls[0]![0] as SubAgentTask;
    expect(firstCall.description).toBe('First task');
  });

  it('warns on negative depends_on index', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Done'));

    const result = await executeDelegation(
      {
        plan: 'Negative dep',
        subtasks: [{ task: 'Bad dep', depends_on: -1 }],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    expect(result).toContain('Warning');
    expect(result).toContain('invalid depends_on=-1');
  });

  it('annotates dependency context when dependent task had budget_exceeded', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Partial results from budget exceeded', 'budget_exceeded'))
      .mockResolvedValueOnce(makeResult('task-1', 'Analyzed partial'));

    const result = await executeDelegation(
      {
        plan: 'Budget exceeded dep',
        subtasks: [
          { task: 'Expensive search' },
          { task: 'Analyze results', depends_on: 0 },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    // Second task should have annotated context
    const secondCall = spawnSpy.mock.calls[1]![0] as SubAgentTask;
    expect(secondCall.description).toContain('budget_exceeded');
    expect(secondCall.description).toContain('results may be incomplete');
    expect(secondCall.description).toContain('Partial results from budget exceeded');

    // Both tasks execute (only error status halts)
    expect(spawnSpy).toHaveBeenCalledTimes(2);
    expect(result).toContain('Analyzed partial');
  });

  it('annotates dependency context when dependent task had timeout', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Timed out mid-search', 'timeout'))
      .mockResolvedValueOnce(makeResult('task-1', 'Handled timeout'));

    await executeDelegation(
      {
        plan: 'Timeout dep',
        subtasks: [
          { task: 'Slow search' },
          { task: 'Handle results', depends_on: 0 },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    const secondCall = spawnSpy.mock.calls[1]![0] as SubAgentTask;
    expect(secondCall.description).toContain('timeout');
    expect(secondCall.description).toContain('results may be incomplete');
  });

  it('generates correct summary with mixed statuses', async () => {
    const spawnSpy = vi.fn<(task: SubAgentTask, ...args: unknown[]) => Promise<SubAgentResult>>()
      .mockResolvedValueOnce(makeResult('task-0', 'Success'))
      .mockResolvedValueOnce(makeResult('task-1', 'Over budget', 'budget_exceeded'))
      .mockResolvedValueOnce(makeResult('task-2', 'Also success'));

    const result = await executeDelegation(
      {
        plan: 'Mixed status plan',
        subtasks: [
          { task: 'Step 1' },
          { task: 'Step 2' },
          { task: 'Step 3' },
        ],
      },
      DEFAULT_CONFIG,
      mockClient,
      mockRegistry,
      spawnSpy,
    );

    // All 3 should execute (budget_exceeded does not halt)
    expect(spawnSpy).toHaveBeenCalledTimes(3);
    // Summary should show 2/3 completed (budget_exceeded is NOT counted as completed)
    expect(result).toContain('Completed: 2/3');
    expect(result).toContain('Total tool calls: 6'); // 3 * 2
  });
});
