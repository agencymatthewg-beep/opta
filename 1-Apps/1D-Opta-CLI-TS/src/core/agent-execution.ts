/**
 * agent-execution.ts — Parallel tool dispatch with semaphore.
 *
 * Extracted from agent.ts to isolate the bounded-concurrency tool execution,
 * result collection, and tool card display logic.
 */

import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { debug } from './debug.js';
import { errorMessage } from '../utils/errors.js';
import { safeParseJson } from '../utils/json.js';
import { formatToolCall, formatToolResult } from '../ui/toolcards.js';
import type { Spinner } from '../ui/spinner.js';
import type { OnStreamCallbacks } from './agent.js';
import type { AgentMessage } from './agent.js';
import type { ToolCallAccum } from './agent-streaming.js';
import type { ToolDecision } from './agent-permissions.js';
import type { SessionContext } from '../hooks/integration.js';
import { fireToolPost, type HookManager } from '../hooks/integration.js';
import type { InsightEngine } from './insights.js';

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
  registry: { execute: (name: string, args: string) => Promise<string>; close: () => Promise<void> };
}

export interface ExecutionResult {
  /** Number of tools that were successfully executed. */
  toolCallsDelta: number;
  /** New checkpoint count after any checkpoint creation. */
  checkpointCount: number;
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
  prevCheckpointCount: number,
): Promise<ExecutionResult> {
  const maxParallel = ctx.config.safety.maxParallelTools;
  let toolCallCount = prevToolCallCount;
  let checkpointCount = prevCheckpointCount;

  const approvedCalls = decisions.filter(d => d.approved);

  // Simple semaphore for bounded concurrency
  let running = 0;
  const queue: Array<() => void> = [];
  const acquire = () => new Promise<void>(resolve => {
    if (running < maxParallel) { running++; resolve(); }
    else queue.push(() => { running++; resolve(); });
  });
  const release = () => { running--; const next = queue.shift(); if (next) next(); };

  const executionResults = new Map<string, { result: string; error?: undefined } | { result?: undefined; error: string }>();

  // Display tool cards for approved calls
  for (const { call } of approvedCalls) {
    if (!ctx.silent) {
      const parsedArgs = safeParseJson<Record<string, unknown>>(call.args, { raw: call.args });
      console.log(formatToolCall(call.name, parsedArgs));
    }
    ctx.streamCallbacks?.onToolStart?.(call.name, call.id, call.args);
    ctx.insightEngine?.toolStart(call.name, call.args);
  }

  // Execute in parallel with semaphore
  if (approvedCalls.length > 0) {
    ctx.spinner.start(`Running ${approvedCalls.length} tool${approvedCalls.length > 1 ? 's' : ''}...`);
    await Promise.all(
      approvedCalls.map(async ({ call }) => {
        await acquire();
        try {
          const result = await ctx.registry.execute(call.name, call.args);
          executionResults.set(call.id, { result });
          ctx.streamCallbacks?.onToolEnd?.(call.name, call.id, result);
          await fireToolPost(ctx.hooks, call.name, call.args, result, ctx.sessionCtx);
        } catch (err) {
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
    const { call } = decision;

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

    toolCallCount++;
    debug(`Tool call #${toolCallCount}: ${call.name} \u2192 ${result.slice(0, 100)}`);

    // Create checkpoint for file-modifying tools (skip for sub-agents)
    if (!ctx.isSubAgent && ctx.config.git.checkpoints && (call.name === 'edit_file' || call.name === 'write_file')) {
      try {
        if (gitUtilsMod && gitCheckpointsMod && await gitUtilsMod.isGitRepo(process.cwd())) {
          const parsedArgs = safeParseJson<Record<string, unknown>>(call.args, {});
          checkpointCount++;
          await gitCheckpointsMod.createCheckpoint(process.cwd(), ctx.sessionId, checkpointCount, call.name, String(parsedArgs['path'] ?? 'unknown'));
        }
      } catch {
        // Checkpoint creation failed — non-fatal
      }
    }
  }

  return { toolCallsDelta: toolCallCount - prevToolCallCount, checkpointCount };
}
