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

/**
 * Build execution waves from subtask dependencies (topological sort).
 *
 * Each wave contains indices of subtasks whose dependencies are all in
 * earlier waves. Subtasks within a wave can execute in parallel.
 */
function buildWaves(subtasks: DelegationPlan['subtasks']): number[][] {
  const n = subtasks.length;
  const assigned = new Set<number>();
  const waves: number[][] = [];

  // Safety: cap iterations at n to prevent infinite loops on bad input
  for (let iter = 0; iter < n && assigned.size < n; iter++) {
    const wave: number[] = [];
    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;

      const dep = subtasks[i]!.depends_on;
      // No dependency, or dependency already completed in a prior wave
      if (dep === undefined || dep < 0 || dep >= n || assigned.has(dep)) {
        wave.push(i);
      }
    }

    if (wave.length === 0) {
      // Remaining tasks have circular or unresolvable dependencies — force them
      for (let i = 0; i < n; i++) {
        if (!assigned.has(i)) wave.push(i);
      }
    }

    for (const idx of wave) assigned.add(idx);
    waves.push(wave);
  }

  return waves;
}

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

  const maxConcurrent = config.subAgent?.maxConcurrent ?? 3;
  const results: (SubAgentResult | null)[] = new Array(plan.subtasks.length).fill(null);
  const lines: string[] = [];
  lines.push(`Delegation: ${plan.plan}`);
  lines.push(`Subtasks: ${plan.subtasks.length}`);
  lines.push('');

  // Build execution waves from dependency graph
  const waves = buildWaves(plan.subtasks);
  let aborted = false;

  for (const wave of waves) {
    if (aborted) break;

    // Execute all subtasks in this wave concurrently (bounded by maxConcurrent)
    const wavePromises = wave.map(async (i) => {
      const subtask = plan.subtasks[i]!;

      // Build description, injecting dependency results
      let description = subtask.task;
      if (subtask.depends_on !== undefined) {
        if (subtask.depends_on < 0 || subtask.depends_on >= plan.subtasks.length) {
          lines.push(`Warning: subtask ${i + 1} has invalid depends_on=${subtask.depends_on} (ignored).`);
        } else {
          const depResult = results[subtask.depends_on];
          if (depResult) {
            if (depResult.status === 'budget_exceeded' || depResult.status === 'timeout') {
              description = `${subtask.task}\n\nContext from previous subtask (${depResult.status} — results may be incomplete):\n${depResult.response}`;
            } else {
              description = `${subtask.task}\n\nContext from previous subtask:\n${depResult.response}`;
            }
          }
        }
      }

      const agentTask: SubAgentTask = {
        id: `${nanoid(8)}`,
        description,
        scope: subtask.scope,
      };

      const result = await spawnFn(agentTask, config, client, registry);
      results[i] = result;
      return { index: i, result };
    });

    // Bounded concurrency: process wave in chunks of maxConcurrent
    for (let start = 0; start < wavePromises.length; start += maxConcurrent) {
      const chunk = wavePromises.slice(start, start + maxConcurrent);
      const settled = await Promise.allSettled(chunk);

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          const { index, result } = outcome.value;
          const subtask = plan.subtasks[index]!;
          lines.push(`--- Subtask ${index + 1}: ${subtask.task} ---`);
          lines.push(`Status: ${result.status}`);
          lines.push(result.response);
          lines.push('');

          if (result.status === 'error') {
            lines.push(`Delegation stopped: subtask ${index + 1} failed with error.`);
            aborted = true;
          }
        } else {
          lines.push(`--- Subtask failed: ${outcome.reason} ---`);
          lines.push('');
          aborted = true;
        }
      }

      if (aborted) break;
    }
  }

  const completed = results.filter(r => r?.status === 'completed');
  const totalToolCalls = results.reduce((sum, r) => sum + (r?.toolCallCount ?? 0), 0);
  const totalDuration = results.reduce((sum, r) => sum + (r?.durationMs ?? 0), 0);

  lines.push('--- Delegation Summary ---');
  lines.push(`Completed: ${completed.length}/${plan.subtasks.length}`);
  lines.push(`Total tool calls: ${totalToolCalls}`);
  lines.push(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);

  return lines.join('\n');
}
