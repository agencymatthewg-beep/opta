import { loadConfig } from '../../core/config.js';
import { agentLoop } from '../../core/agent.js';
import { computeAutonomyConfigUpdates } from '../../core/autonomy.js';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import chalk from 'chalk';
import { execa } from 'execa';

export interface CeoBenchTask {
  id: string;
  description: string;
  setupScript?: string;
  verifyScript: string;
}

export interface CeoBenchResult {
  id: string;
  passed: boolean;
  turns: number;
  durationMs: number;
  error?: string;
}

const DEFAULT_TASKS: CeoBenchTask[] = [
  {
    id: 'math-function',
    description: 'Create a file named math.js that exports a function `add(a, b)` that returns the sum of a and b.',
    verifyScript: `node -e "const { add } = require('./math.js'); if (add(2, 3) !== 5) process.exit(1);"`
  },
  {
    id: 'failing-test',
    description: 'There is a failing test in test.js. Fix the bug in target.js so the test passes.',
    setupScript: `
      echo "module.exports = { multiply: (a, b) => a + b };" > target.js
      echo "const { multiply } = require('./target.js'); if (multiply(3, 4) !== 12) process.exit(1);" > test.js
    `,
    verifyScript: 'node test.js'
  }
];

function applyDotPathUpdate(target: Record<string, unknown>, key: string, value: unknown): void {
  const segments = key.split('.').filter(Boolean);
  if (segments.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!segment) continue;
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      const replacement: Record<string, unknown> = {};
      cursor[segment] = replacement;
      cursor = replacement;
      continue;
    }
    cursor = next as Record<string, unknown>;
  }

  const terminal = segments[segments.length - 1];
  if (terminal) {
    cursor[terminal] = value;
  }
}

export async function runCeoBenchmark(
  options: { filter?: string; model?: string; json?: boolean }
): Promise<void> {
  const config = await loadConfig();
  
  // Force CEO mode config
  const ceoUpdates = computeAutonomyConfigUpdates(5, 'ceo');
  for (const [key, value] of Object.entries(ceoUpdates)) {
    applyDotPathUpdate(config as unknown as Record<string, unknown>, key, value);
  }
  // Ensure we can auto-write
  config.defaultMode = 'dangerous';
  config.autonomy.headlessContinue = true;

  const modelId = options.model ?? config.model.default;
  if (!modelId) {
    throw new Error('No model specified and no default model set.');
  }
  config.model.default = modelId;

  const filterId = options.filter?.trim();
  const tasks = filterId
    ? DEFAULT_TASKS.filter((t) => t.id.includes(filterId))
    : DEFAULT_TASKS;

  if (!options.json) {
    console.log(chalk.bold(`
Starting CEO Autonomy Benchmark`));
    console.log(chalk.dim(`Model: ${modelId}`));
    console.log(chalk.dim(`Tasks: ${tasks.length}
`));
  }

  const results: CeoBenchResult[] = [];
  const originalCwd = process.cwd();

  for (const task of tasks) {
    if (!options.json) console.log(chalk.cyan(`Running task: ${task.id}`));
    const startMs = Date.now();
    let passed = false;
    let turns = 0;
    let error: string | undefined;

    const testDir = await mkdtemp(join(tmpdir(), `opta-ceo-bench-${task.id}-`));
    process.chdir(testDir);

    try {
      if (task.setupScript) {
        await execa('bash', ['-c', task.setupScript]);
      }

      // We give the agent a system prompt telling it to solve the task and verify.
      const prompt = `You are in a CEO benchmark test environment.
Your task: ${task.description}

Once you believe you have completed the task, you MUST run this verification script to ensure it works:
\`\`\`bash
${task.verifyScript}
\`\`\`

If the script fails, keep iterating until it passes. Do not stop until the script exits with 0.`;

      const result = await agentLoop(prompt, config, {
        sessionId: `bench-${task.id}`,
        silent: false
      });

      turns = result.toolCallCount;

      // Final verification
      try {
        await execa('bash', ['-c', task.verifyScript]);
        passed = true;
      } catch {
        passed = false;
        error = 'Verification script failed after agent completion.';
      }

    } catch (err) {
      passed = false;
      error = err instanceof Error ? err.message : String(err);
    } finally {
      process.chdir(originalCwd);
      try { await rm(testDir, { recursive: true, force: true }); } catch {}
    }

    const durationMs = Date.now() - startMs;
    results.push({ id: task.id, passed, turns, durationMs, error });

    if (!options.json) {
      if (passed) {
        console.log(chalk.green(`  ✓ Passed in ${turns} turns (${(durationMs / 1000).toFixed(1)}s)`));
      } else {
        console.log(chalk.red(`  ✗ Failed in ${turns} turns (${(durationMs / 1000).toFixed(1)}s)`));
        if (error) console.log(chalk.dim(`    Error: ${error}`));
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const passedCount = results.filter(r => r.passed).length;
    console.log(chalk.bold(`
Benchmark Complete: ${passedCount}/${results.length} passed`));
  }
}
