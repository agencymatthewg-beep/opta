import { nanoid } from 'nanoid';
import type { OptaConfig } from './config.js';
import type { SubAgentTask, SubAgentResult, SubAgentContext } from './subagent.js';
import type { ToolRegistry } from '../mcp/registry.js';

interface DelegationPlan {
  plan: string;
  subtasks: Array<{
    task: string;
    scope?: string;
    depends_on?: number;
  }>;
}

type SpawnFn = (
  task: SubAgentTask,
  config: OptaConfig,
  client: import('openai').default,
  registry: ToolRegistry,
  parentContext?: SubAgentContext
) => Promise<SubAgentResult>;

const MAX_SUBTASKS = 5;

export async function executeDelegation(
  plan: DelegationPlan,
  config: OptaConfig,
  client: import('openai').default,
  registry: ToolRegistry,
  spawnFn: SpawnFn
): Promise<string> {
  if (plan.subtasks.length > MAX_SUBTASKS) {
    throw new Error(`Maximum ${MAX_SUBTASKS} subtasks allowed per delegation.`);
  }

  if (plan.subtasks.length === 0) {
    return `Delegation: ${plan.plan}\n\nNo subtasks to execute.`;
  }

  const results: SubAgentResult[] = [];
  const lines: string[] = [];
  lines.push(`Delegation: ${plan.plan}`);
  lines.push(`Subtasks: ${plan.subtasks.length}`);
  lines.push('');

  for (let i = 0; i < plan.subtasks.length; i++) {
    const subtask = plan.subtasks[i]!;

    // Build the task description, injecting dependency results
    let description = subtask.task;
    if (subtask.depends_on !== undefined) {
      if (subtask.depends_on < 0 || subtask.depends_on >= i) {
        // Invalid dependency: negative index or forward reference
        lines.push(`Warning: subtask ${i + 1} has invalid depends_on=${subtask.depends_on} (ignored).`);
      } else if (subtask.depends_on < results.length) {
        const depResult = results[subtask.depends_on]!;
        if (depResult.status === 'budget_exceeded' || depResult.status === 'timeout') {
          description = `${subtask.task}\n\nContext from previous subtask (${depResult.status} — results may be incomplete):\n${depResult.response}`;
        } else {
          description = `${subtask.task}\n\nContext from previous subtask:\n${depResult.response}`;
        }
      }
    }

    const agentTask: SubAgentTask = {
      id: `${nanoid(8)}`,
      description,
      scope: subtask.scope,
    };

    const result = await spawnFn(agentTask, config, client, registry);
    results.push(result);

    lines.push(`--- Subtask ${i + 1}: ${subtask.task} ---`);
    lines.push(`Status: ${result.status}`);
    lines.push(result.response);
    lines.push('');

    // Stop on error (default behavior)
    if (result.status === 'error') {
      lines.push(`Delegation stopped: subtask ${i + 1} failed with error.`);
      break;
    }
  }

  lines.push('--- Delegation Summary ---');
  lines.push(`Completed: ${results.filter(r => r.status === 'completed').length}/${plan.subtasks.length}`);
  lines.push(`Total tool calls: ${results.reduce((sum, r) => sum + r.toolCallCount, 0)}`);
  lines.push(`Total duration: ${(results.reduce((sum, r) => sum + r.durationMs, 0) / 1000).toFixed(1)}s`);

  return lines.join('\n');
}
