import { loadConfig } from '../../core/config.js';
import { agentLoop } from '../../core/agent.js';
import { computeAutonomyConfigUpdates } from '../../core/autonomy.js';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

export interface RunCeoBenchmarkOptions {
  filter?: string;
  model?: string;
  json?: boolean;
  autonomyLevel?: number;
  configOverrides?: Record<string, unknown>;
}

export interface CeoBenchTraceToolCall {
  id: string;
  name: string;
  args: string;
  durationMs: number;
  error?: string;
}

export interface CeoBenchTraceTurn {
  taskId: string;
  turnIndex: number;
  toolCalls: CeoBenchTraceToolCall[];
  errors: string[];
  durationMs: number;
}

export interface CeoBenchLoopSignal {
  triggered: true;
  repeatCount: number;
  repeatThreshold: number;
  turnIndex: number;
  signature: string;
}

export interface CeoBenchTraceArtifact {
  schemaVersion: 1;
  taskId: string;
  sessionId: string;
  generatedAt: string;
  durationMs: number;
  loopControl: {
    repeatThreshold: number;
    triggered: boolean;
    repeatCount?: number;
    turnIndex?: number;
    signature?: string;
  };
  turns: CeoBenchTraceTurn[];
}

interface LiveToolCall {
  trace: CeoBenchTraceToolCall;
  startedAtMs: number;
}

interface LiveTurn {
  turnIndex: number;
  startedAtMs: number;
  toolCalls: LiveToolCall[];
}

interface CeoBenchTraceCollectorOptions {
  taskId: string;
  repeatThreshold?: number;
}

const DEFAULT_LOOP_REPEAT_THRESHOLD = 3;

function clipTraceField(value: string, maxLen = 300): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 3)}...`;
}

function stableSortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortForSignature);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const sortedEntries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const normalized: Record<string, unknown> = {};
  for (const [key, nested] of sortedEntries) {
    normalized[key] = stableSortForSignature(nested);
  }
  return normalized;
}

function normalizeArgsForSignature(args: string): string {
  const trimmed = args.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return JSON.stringify(stableSortForSignature(parsed));
  } catch {
    return trimmed.replace(/\s+/g, ' ');
  }
}

export function buildTurnLoopSignature(
  toolCalls: ReadonlyArray<Pick<CeoBenchTraceToolCall, 'name' | 'args'>>
): string {
  return toolCalls
    .map((call) => `${call.name}:${normalizeArgsForSignature(call.args)}`)
    .join('||');
}

function isToolResultError(result: string): boolean {
  const normalized = result.trim().toLowerCase();
  return normalized.startsWith('error:') || normalized.includes('[exit code: 1]');
}

export class CeoBenchTraceCollector {
  private readonly taskId: string;
  private readonly repeatThreshold: number;
  private readonly turns: CeoBenchTraceTurn[] = [];
  private activeTurn: LiveTurn | null = null;
  private pendingCalls = new Map<string, LiveToolCall>();
  private lastSignature = '';
  private repeatCount = 0;
  private loopSignal: CeoBenchLoopSignal | null = null;

  constructor(options: CeoBenchTraceCollectorOptions) {
    this.taskId = options.taskId;
    this.repeatThreshold = Math.max(2, options.repeatThreshold ?? DEFAULT_LOOP_REPEAT_THRESHOLD);
  }

  public getRepeatThreshold(): number {
    return this.repeatThreshold;
  }

  public onToolStart(name: string, id: string, args: string): void {
    if (!this.activeTurn) {
      this.activeTurn = {
        turnIndex: this.turns.length + 1,
        startedAtMs: Date.now(),
        toolCalls: [],
      };
    }

    const trace: CeoBenchTraceToolCall = {
      id,
      name,
      args: clipTraceField(args, 400),
      durationMs: 0,
    };
    const liveCall: LiveToolCall = { trace, startedAtMs: Date.now() };
    this.activeTurn.toolCalls.push(liveCall);
    this.pendingCalls.set(id, liveCall);
  }

  public onToolEnd(name: string, id: string, result: string): CeoBenchLoopSignal | null {
    const liveCall = this.pendingCalls.get(id);
    if (!liveCall) {
      return null;
    }

    liveCall.trace.durationMs = Math.max(0, Date.now() - liveCall.startedAtMs);
    if (name && !liveCall.trace.name) {
      liveCall.trace.name = name;
    }
    if (isToolResultError(result)) {
      liveCall.trace.error = clipTraceField(result, 500);
    }
    this.pendingCalls.delete(id);

    if (this.pendingCalls.size > 0) {
      return null;
    }

    return this.finalizeActiveTurn(true);
  }

  public flushPartialTurn(reason?: string): void {
    if (!this.activeTurn) return;

    const fallbackError = reason
      ? clipTraceField(reason, 500)
      : 'Tool call ended before completion (benchmark loop interrupted).';
    const endTime = Date.now();
    for (const call of this.activeTurn.toolCalls) {
      if (call.trace.durationMs === 0) {
        call.trace.durationMs = Math.max(0, endTime - call.startedAtMs);
      }
      if (!call.trace.error) {
        call.trace.error = fallbackError;
      }
    }
    this.pendingCalls.clear();
    this.finalizeActiveTurn(false);
  }

  public getTurns(): CeoBenchTraceTurn[] {
    return this.turns.map((turn) => ({
      taskId: turn.taskId,
      turnIndex: turn.turnIndex,
      durationMs: turn.durationMs,
      errors: [...turn.errors],
      toolCalls: turn.toolCalls.map((call) => ({ ...call })),
    }));
  }

  public getTotalToolCalls(): number {
    return this.turns.reduce((total, turn) => total + turn.toolCalls.length, 0);
  }

  public getLoopSignal(): CeoBenchLoopSignal | null {
    return this.loopSignal ? { ...this.loopSignal } : null;
  }

  private finalizeActiveTurn(enableLoopDetection: boolean): CeoBenchLoopSignal | null {
    if (!this.activeTurn) return null;

    const finalizedTurn: CeoBenchTraceTurn = {
      taskId: this.taskId,
      turnIndex: this.activeTurn.turnIndex,
      durationMs: Math.max(0, Date.now() - this.activeTurn.startedAtMs),
      toolCalls: this.activeTurn.toolCalls.map((call) => ({ ...call.trace })),
      errors: this.activeTurn.toolCalls
        .map((call) => call.trace.error)
        .filter((error): error is string => typeof error === 'string'),
    };
    this.turns.push(finalizedTurn);
    this.activeTurn = null;

    if (!enableLoopDetection || finalizedTurn.toolCalls.length === 0) {
      return null;
    }

    const signature = buildTurnLoopSignature(finalizedTurn.toolCalls);
    if (!signature) {
      this.repeatCount = 0;
      this.lastSignature = '';
      return null;
    }

    if (signature === this.lastSignature) {
      this.repeatCount += 1;
    } else {
      this.lastSignature = signature;
      this.repeatCount = 1;
    }

    if (this.repeatCount < this.repeatThreshold) {
      return null;
    }

    this.loopSignal = {
      triggered: true,
      repeatCount: this.repeatCount,
      repeatThreshold: this.repeatThreshold,
      turnIndex: finalizedTurn.turnIndex,
      signature: clipTraceField(signature, 500),
    };
    return { ...this.loopSignal };
  }
}

function sanitizeFileToken(input: string): string {
  return input.replace(/[^A-Za-z0-9._-]/g, '-');
}

export async function persistCeoBenchTraceArtifact(
  repoRoot: string,
  artifact: CeoBenchTraceArtifact
): Promise<string> {
  const traceDir = join(repoRoot, 'docs', 'evidence', 'ceo-bench');
  await mkdir(traceDir, { recursive: true });

  const timestamp = artifact.generatedAt.replace(/[.:]/g, '-');
  const filename = `${timestamp}-${sanitizeFileToken(artifact.taskId)}.json`;
  const tracePath = join(traceDir, filename);
  await writeFile(tracePath, JSON.stringify(artifact, null, 2), 'utf8');
  return tracePath;
}

function buildLoopControlError(taskId: string, loopSignal: CeoBenchLoopSignal): string {
  return [
    `Loop control stop: repetitive tool-call plan detected for task "${taskId}".`,
    `Repeated ${loopSignal.repeatCount} consecutive turns (threshold ${loopSignal.repeatThreshold}) by turn ${loopSignal.turnIndex}.`,
    'Action: inspect trace artifact, then reduce autonomy or adjust model/prompt before retrying.',
  ].join(' ');
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

export function buildCeoBenchmarkPrompt(task: CeoBenchTask): string {
  return `You are in an isolated CEO benchmark workspace.
Your task: ${task.description}

Execution rules:
- Work only on files in the current directory.
- Do not produce implementation plans; execute immediately.
- Do not call read_project_docs unless absolutely necessary.
- After each edit, run the verification script.
- Keep iterating until the verification script exits with code 0.

Verification script:
\`\`\`bash
${task.verifyScript}
\`\`\`

When verification passes, respond with: VERIFIED`;
}

export async function seedBenchmarkWorkspace(testDir: string, task: CeoBenchTask): Promise<void> {
  const appDoc = `# CEO Benchmark Workspace

This workspace is ephemeral and used for autonomous benchmark execution.
Task ID: ${task.id}
Goal: ${task.description}
`;
  const indexDoc = `# INDEX

- APP.md — Benchmark objective and guardrails.
`;
  await writeFile(join(testDir, 'APP.md'), appDoc, 'utf8');
  await writeFile(join(testDir, 'INDEX.md'), indexDoc, 'utf8');
}

export async function runCeoBenchmark(
  options: RunCeoBenchmarkOptions
): Promise<void> {
  const config = await loadConfig(options.configOverrides);
  
  // Force CEO mode config
  const requestedAutonomy = Number.isFinite(options.autonomyLevel)
    ? Math.max(1, Math.min(5, Math.floor(options.autonomyLevel as number)))
    : 5;
  const ceoUpdates = computeAutonomyConfigUpdates(requestedAutonomy, 'ceo');
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
  if (tasks.length === 0) {
    throw new Error(`No benchmark tasks matched filter "${filterId}".`);
  }

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
    let tracePath: string | undefined;
    let loopControlError: string | undefined;
    const sessionId = `bench-${task.id}`;
    const traceCollector = new CeoBenchTraceCollector({ taskId: task.id });
    const loopAbortController = new AbortController();

    const testDir = await mkdtemp(join(tmpdir(), `opta-ceo-bench-${task.id}-`));
    process.chdir(testDir);

    try {
      await seedBenchmarkWorkspace(testDir, task);
      if (task.setupScript) {
        await execa('bash', ['-c', task.setupScript]);
      }

      // Keep benchmark prompts deterministic to reduce planner loops.
      const prompt = buildCeoBenchmarkPrompt(task);

      const result = await agentLoop(prompt, config, {
        sessionId,
        silent: false,
        signal: loopAbortController.signal,
        onStream: {
          onToolStart: (name, id, args) => {
            traceCollector.onToolStart(name, id, args);
          },
          onToolEnd: (name, id, resultText) => {
            const loopSignal = traceCollector.onToolEnd(name, id, resultText);
            if (loopSignal?.triggered && !loopAbortController.signal.aborted) {
              loopControlError = buildLoopControlError(task.id, loopSignal);
              loopAbortController.abort();
            }
          },
        },
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
      if (err instanceof Error && err.name === 'AbortError' && loopControlError) {
        error = loopControlError;
      } else {
        error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      traceCollector.flushPartialTurn(loopControlError);

      const loopSignal = traceCollector.getLoopSignal();
      const traceArtifact: CeoBenchTraceArtifact = {
        schemaVersion: 1,
        taskId: task.id,
        sessionId,
        generatedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - startMs),
        loopControl: {
          repeatThreshold: traceCollector.getRepeatThreshold(),
          triggered: Boolean(loopSignal),
          repeatCount: loopSignal?.repeatCount,
          turnIndex: loopSignal?.turnIndex,
          signature: loopSignal?.signature,
        },
        turns: traceCollector.getTurns(),
      };
      try {
        tracePath = await persistCeoBenchTraceArtifact(originalCwd, traceArtifact);
      } catch {
        // Trace persistence is best-effort to avoid masking benchmark outcomes.
      }

      if (turns === 0) {
        turns = traceCollector.getTotalToolCalls();
      }
      if (error && tracePath && !error.includes('Trace:')) {
        error = `${error} Trace: ${tracePath}`;
      }

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
      if (tracePath) {
        console.log(chalk.dim(`    Trace: ${tracePath}`));
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
