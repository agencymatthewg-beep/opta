/**
 * agent-execution.ts — Parallel tool dispatch with semaphore.
 *
 * Extracted from agent.ts to isolate the bounded-concurrency tool execution,
 * result collection, and tool card display logic.
 */

import type { OptaConfig } from './config.js';
import { debug } from './debug.js';
import { errorMessage } from '../utils/errors.js';
import { safeParseJson } from '../utils/json.js';
import { formatToolCall, formatToolResult } from '../ui/toolcards.js';
import type { Spinner } from '../ui/spinner.js';
import type { OnStreamCallbacks } from './agent.js';
import type { AgentMessage } from './agent.js';
import type { ToolDecision } from './agent-permissions.js';
import type { SessionContext } from '../hooks/integration.js';
import { fireToolPost, type HookManager } from '../hooks/integration.js';
import type { InsightEngine } from './insights.js';
import type { SubAgentContext } from './subagent.js';

// --- Types ---

export interface ExecutionContext {
  config: OptaConfig;
  spinner: Spinner;
  silent: boolean;
  isSubAgent: boolean;
  sessionId: string;
  streamCallbacks?: OnStreamCallbacks;
  insightEngine?: InsightEngine | null;
  hooks: HookManager;
  sessionCtx: SessionContext;
  /** The tool registry with execute() and close() methods. */
  registry: {
    execute: (
      name: string,
      args: string,
      parentCtx?: SubAgentContext,
      signal?: AbortSignal
    ) => Promise<string>;
    close: () => Promise<void>;
  };
  signal?: AbortSignal;
}

export interface ExecutionResult {
  /** Number of tools that were successfully executed. */
  toolCallsDelta: number;
  /** New checkpoint count after any checkpoint creation. */
  checkpointCount: number;
}

function queueLearningCapture(
  config: OptaConfig,
  event: import('../learning/hooks.js').CaptureLearningEventInput
): void {
  if (!config.learning.enabled) return;
  void import('../learning/hooks.js')
    .then(({ captureLearningEvent }) => captureLearningEvent(config, event))
    .catch(() => {});
}

function isSuccessfulVerificationCommand(
  toolName: string,
  args: Record<string, unknown>,
  result: string
): boolean {
  if (toolName !== 'run_command') return false;
  if (!result.includes('[exit code: 0]')) return false;
  const command = (typeof args['command'] === 'string' ? args['command'] : '').toLowerCase();
  return /(test|build|typecheck|lint|vitest|npm run)/.test(command);
}

/**
 * Execute approved tool calls in parallel (bounded concurrency), collect results
 * in original order, and push tool messages onto the conversation.
 */
export async function executeToolCalls(
  decisions: ToolDecision[],
  messages: AgentMessage[],
  ctx: ExecutionContext,
  prevToolCallCount: number,
  prevCheckpointCount: number
): Promise<ExecutionResult> {
  const ensureNotAborted = () => {
    if (ctx.signal?.aborted) {
      const err = new Error('Turn cancelled');
      err.name = 'AbortError';
      throw err;
    }
  };

  ensureNotAborted();
  const maxParallel = ctx.config.safety.maxParallelTools;
  let toolCallCount = prevToolCallCount;
  let checkpointCount = prevCheckpointCount;

  const approvedCalls = decisions.filter((d) => d.approved);

  // Simple semaphore for bounded concurrency
  let running = 0;
  const queue: Array<() => void> = [];
  const acquire = () =>
    new Promise<void>((resolve) => {
      if (running < maxParallel) {
        running++;
        resolve();
      } else
        queue.push(() => {
          running++;
          resolve();
        });
    });
  const release = () => {
    running--;
    const next = queue.shift();
    if (next) next();
  };

  const executionResults = new Map<
    string,
    { result: string; error?: undefined } | { result?: undefined; error: string }
  >();

  // Display tool cards for approved calls
  for (const { call, executionArgsJson } of approvedCalls) {
    const effectiveArgs = executionArgsJson ?? call.args;
    if (!ctx.silent) {
      const parsedArgs = safeParseJson<Record<string, unknown>>(effectiveArgs, {
        raw: effectiveArgs,
      });
      console.log(formatToolCall(call.name, parsedArgs));
    }
    ctx.streamCallbacks?.onToolStart?.(call.name, call.id, effectiveArgs);
    ctx.insightEngine?.toolStart(call.name, effectiveArgs);
  }

  // Execute in parallel with semaphore
  if (approvedCalls.length > 0) {
    ctx.spinner.start(
      `Running ${approvedCalls.length} tool${approvedCalls.length > 1 ? 's' : ''}...`
    );
    await Promise.all(
      approvedCalls.map(async ({ call, executionArgsJson }) => {
        ensureNotAborted();
        await acquire();
        try {
          ensureNotAborted();
          const effectiveArgs = executionArgsJson ?? call.args;
          const result = await ctx.registry.execute(
            call.name,
            effectiveArgs,
            undefined,
            ctx.signal
          );
          executionResults.set(call.id, { result });
          ctx.streamCallbacks?.onToolEnd?.(call.name, call.id, result);
          await fireToolPost(ctx.hooks, call.name, effectiveArgs, result, ctx.sessionCtx);
        } catch (err) {
          if (ctx.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
            throw err;
          }
          const errMsg = errorMessage(err);
          executionResults.set(call.id, { error: `Error: ${errMsg}` });
          ctx.streamCallbacks?.onToolEnd?.(call.name, call.id, `Error: ${errMsg}`);
        } finally {
          release();
        }
      })
    );
    ctx.spinner.succeed(`${approvedCalls.length} tool${approvedCalls.length > 1 ? 's' : ''} done`);
  }

  // Collect results in original order
  // Lazy-load git modules only when needed
  let gitUtilsMod: typeof import('../git/utils.js') | null = null;
  let gitCheckpointsMod: typeof import('../git/checkpoints.js') | null = null;
  if (!ctx.isSubAgent && ctx.config.git.checkpoints) {
    gitUtilsMod = await import('../git/utils.js');
    gitCheckpointsMod = await import('../git/checkpoints.js');
  }

  for (const decision of decisions) {
    ensureNotAborted();
    const { call } = decision;
    const effectiveArgs = decision.executionArgsJson ?? call.args;

    if (!decision.approved) {
      messages.push({
        role: 'tool',
        content: decision.denialReason ?? 'Permission denied.',
        tool_call_id: call.id,
      });
      continue;
    }

    const execResult = executionResults.get(call.id);
    const result = execResult?.result ?? execResult?.error ?? 'Error: no result';

    if (!ctx.silent && result) {
      console.log(formatToolResult(call.name, result));
    }

    messages.push({
      role: 'tool',
      content: result,
      tool_call_id: call.id,
    });

    const parsedArgs = safeParseJson<Record<string, unknown>>(effectiveArgs, {});
    if (result.startsWith('Error:')) {
      queueLearningCapture(ctx.config, {
        kind: 'problem',
        topic: `Tool failure: ${call.name}`,
        content: result.slice(0, 1200),
        tags: ['tool-failure', call.name],
        evidence: [{ label: 'session', uri: `session://${ctx.sessionId}` }],
        metadata: {
          tool: call.name,
          args: parsedArgs,
        },
        verified: false,
      });
    } else if (isSuccessfulVerificationCommand(call.name, parsedArgs, result)) {
      const cmdVal = parsedArgs['command'];
      const cmdStr =
        typeof cmdVal === 'string'
          ? cmdVal
          : typeof cmdVal === 'object'
            ? JSON.stringify(cmdVal)
            : String(cmdVal as number | boolean | bigint | null | undefined);
      queueLearningCapture(ctx.config, {
        kind: 'solution',
        topic: `Verification succeeded: ${cmdStr.slice(0, 120)}`,
        content: result.slice(0, 1200),
        tags: ['verification', 'success', 'run_command'],
        evidence: [{ label: 'session', uri: `session://${ctx.sessionId}` }],
        metadata: {
          tool: call.name,
          args: parsedArgs,
        },
        verified: true,
      });
    }

    toolCallCount++;
    debug(`Tool call #${toolCallCount}: ${call.name} \u2192 ${result.slice(0, 100)}`);

    // Create checkpoint for file-modifying tools (skip for sub-agents)
    if (
      !ctx.isSubAgent &&
      ctx.config.git.checkpoints &&
      (call.name === 'edit_file' || call.name === 'write_file')
    ) {
      try {
        if (gitUtilsMod && gitCheckpointsMod && (await gitUtilsMod.isGitRepo(process.cwd()))) {
          checkpointCount++;
          await gitCheckpointsMod.createCheckpoint(
            process.cwd(),
            ctx.sessionId,
            checkpointCount,
            call.name,
            typeof parsedArgs['path'] === 'string' ? parsedArgs['path'] : 'unknown'
          );
        }
      } catch {
        // Checkpoint creation failed — non-fatal
      }
    }
  }

  return { toolCallsDelta: toolCallCount - prevToolCallCount, checkpointCount };
}
