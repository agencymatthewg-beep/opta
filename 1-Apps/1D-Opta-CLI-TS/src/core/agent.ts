/**
 * agent.ts — Main agent loop orchestrator.
 *
 * Delegates to focused modules:
 *   agent-setup.ts      — Client creation, system prompt, compaction
 *   agent-streaming.ts  — Stream collection + retry logic
 *   agent-permissions.ts — Tool approval flow
 *   agent-execution.ts  — Parallel tool dispatch with semaphore
 */

import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { ensureModel } from './errors.js';
import { debug } from './debug.js';
import { errorMessage } from '../utils/errors.js';
import { estimateMessageTokens } from '../utils/tokens.js';
import { createSpinner, type Spinner } from '../ui/spinner.js';
import { ThinkingRenderer } from '../ui/thinking.js';
import { StatusBar } from '../ui/statusbar.js';
import type { SubAgentContext } from './subagent.js';
import {
  createHookManager,
  fireSessionStart,
  fireSessionEnd,
  fireCompact,
  fireError,
  type SessionContext,
} from '../hooks/integration.js';

// --- Re-export sub-module types for consumers ---
export { resetClientCache, buildSystemPrompt } from './agent-setup.js';
export type { ToolCallAccum } from './agent-streaming.js';
export type { ToolDecision } from './agent-permissions.js';

// --- Types (public API — unchanged) ---

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OnStreamCallbacks {
  onToken?: (text: string) => void;
  onToolStart?: (name: string, id: string, args: string) => void;
  onToolEnd?: (name: string, id: string, result: string) => void;
  onThinking?: (text: string) => void;
  /**
   * Called when a tool requires 'ask' permission.
   * The callback must return a Promise that resolves to true (allow) or false (deny).
   * If 'always' is chosen, the caller should persist the permission and return true.
   */
  onPermissionRequest?: (toolName: string, args: Record<string, unknown>) => Promise<'allow' | 'deny' | 'always'>;
  /** Called when connection status changes during streaming (reconnection attempts). */
  onConnectionStatus?: (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => void;
  /** Called with inference observability insights (performance, context, tool selection). */
  onInsight?: (insight: import('./insights.js').Insight) => void;
  /** Called when the API returns token usage data (from final streaming chunk). */
  onUsage?: (usage: { promptTokens: number; completionTokens: number }) => void;
}

export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
  silent?: boolean;
  mode?: string;
  imageBase64?: string;
  /** Multiple images for multimodal vision support. */
  images?: Array<{ base64: string; mimeType: string; name?: string }>;
  subAgentContext?: SubAgentContext;
  profile?: string;
  onStream?: OnStreamCallbacks;
}

export interface AgentLoopResult {
  messages: AgentMessage[];
  toolCallCount: number;
  lastThinkingRenderer?: ThinkingRenderer;
}

// --- Main Agent Loop ---

export async function agentLoop(
  task: string,
  config: OptaConfig,
  options?: AgentLoopOptions
): Promise<AgentLoopResult> {
  // --- Imports from sub-modules ---
  const { getOrCreateClient, buildSystemPrompt, compactHistory, maskOldObservations } = await import('./agent-setup.js');
  const { createStreamWithRetry, collectStream } = await import('./agent-streaming.js');
  const { resolveToolDecisions } = await import('./agent-permissions.js');
  const { executeToolCalls } = await import('./agent-execution.js');

  const isSubAgent = !!options?.subAgentContext;

  // When running as a sub-agent, apply derived config overrides
  let effectiveConfig: OptaConfig;
  if (isSubAgent) {
    const { deriveChildConfig } = await import('./subagent.js');
    effectiveConfig = deriveChildConfig(config, options?.mode, options?.subAgentContext?.budget);
  } else {
    effectiveConfig = config;
  }

  const client = await getOrCreateClient(effectiveConfig);

  const model = effectiveConfig.model.default;
  ensureModel(model);

  // Use existing messages (multi-turn) or start fresh (single-shot)
  // Build multimodal content if images are provided (single or multiple)
  const allImages: Array<{ base64: string; mimeType: string; name?: string }> = [];
  if (options?.imageBase64) {
    allImages.push({ base64: options.imageBase64, mimeType: 'image/png' });
  }
  if (options?.images) {
    allImages.push(...options.images);
  }

  const userMessage: AgentMessage = allImages.length > 0
    ? {
        role: 'user',
        content: [
          { type: 'text', text: task },
          ...allImages.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img.base64.startsWith('data:') ? img.base64 : `data:${img.mimeType};base64,${img.base64}` },
          })),
        ],
      }
    : { role: 'user', content: task };

  let systemPrompt: string;
  if (isSubAgent) {
    // Sub-agents get a lightweight prompt without OPIS/export map
    const { buildSubAgentPrompt } = await import('./subagent.js');
    const cwd = options?.subAgentContext?.parentCwd ?? process.cwd();
    const maxToolCalls = options?.subAgentContext?.budget.maxToolCalls ?? 15;
    systemPrompt = buildSubAgentPrompt(task, cwd, maxToolCalls);
  } else {
    systemPrompt = await buildSystemPrompt(effectiveConfig, undefined, options?.mode);
  }

  // If an agent profile is active, append its system prompt suffix
  if (options?.profile) {
    const { getAgentProfile } = await import('./agent-profiles.js');
    const activeProfile = getAgentProfile(options.profile);
    if (activeProfile?.systemPromptSuffix) {
      systemPrompt += '\n\n' + activeProfile.systemPromptSuffix;
    }
  }

  const messages: AgentMessage[] = options?.existingMessages
    ? [...options.existingMessages, userMessage]
    : [
        { role: 'system', content: systemPrompt },
        userMessage,
      ];

  let toolCallCount = 0;
  // Sub-agents are always silent
  const silent = isSubAgent || (options?.silent ?? false);
  const noopSpinner: Spinner = { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {} };
  const spinner = silent ? noopSpinner : await createSpinner();
  const sessionId = options?.sessionId ?? 'unknown';

  // Status bar for real-time stats
  const statusBar = silent ? null : new StatusBar({
    model,
    sessionId,
    provider: effectiveConfig.provider.active,
  });
  let checkpointCount = 0;
  let lastThinkingRenderer: ThinkingRenderer | undefined;
  const streamCallbacks = options?.onStream;

  // Insight engine for REPL mode (non-TUI, non-silent)
  // TUI mode uses its own InsightEngine wired through the adapter.
  let insightEngine: import('./insights.js').InsightEngine | null = null;
  if (!silent && !streamCallbacks?.onInsight && effectiveConfig.insights.enabled) {
    const { InsightEngine } = await import('./insights.js');
    const { formatInsight } = await import('../ui/insights.js');
    insightEngine = new InsightEngine((insight) => {
      console.log(formatInsight(insight));
    });
    insightEngine.setModel(model);
    insightEngine.setContextLimit(effectiveConfig.model.contextLimit);
  }

  // Initialize background process manager (skip for sub-agents to avoid replacing parent's)
  const { initProcessManager, shutdownProcessManager } = await import('./tools/index.js');
  if (!isSubAgent) {
    initProcessManager(effectiveConfig);
  }

  const { buildToolRegistry } = await import('../mcp/registry.js');
  const registry = await buildToolRegistry(effectiveConfig, options?.mode);

  // Filter tool schemas by agent profile (if active)
  let activeSchemas = registry.schemas;
  if (options?.profile) {
    const { getAgentProfile } = await import('./agent-profiles.js');
    const activeProfile = getAgentProfile(options.profile);
    if (activeProfile?.tools && activeProfile.tools.length > 0) {
      const allowedTools = new Set(activeProfile.tools);
      activeSchemas = registry.schemas.filter(
        (s: { function: { name: string } }) => allowedTools.has(s.function.name)
      );
      debug(`Profile "${options.profile}" filtered tools: ${activeSchemas.length}/${registry.schemas.length}`);
    }
  }

  // Initialize hook manager (no-op when no hooks configured)
  const hooks = createHookManager(effectiveConfig);
  const sessionCtx: SessionContext = {
    sessionId,
    cwd: process.cwd(),
    model,
  };
  if (!isSubAgent) {
    await fireSessionStart(hooks, sessionCtx);
  }

  // Hoist dynamic imports used inside the loop to avoid per-iteration await overhead
  const { saveConfig: saveConfigFn } = await import('./config.js');
  const gitUtilsMod = await import('../git/utils.js');
  const gitCheckpointsMod = await import('../git/checkpoints.js');
  const gitCommitMod = await import('../git/commit.js');

  try {
    while (true) {
      // 0. Observation masking (free context savings)
      const maskedMessages = maskOldObservations(messages, 4);
      messages.length = 0;
      messages.push(...maskedMessages);

      // 1. Context compaction
      const tokenEstimate = estimateMessageTokens(messages);
      insightEngine?.contextUpdate(tokenEstimate);
      const threshold = effectiveConfig.model.contextLimit * effectiveConfig.safety.compactAt;
      if (tokenEstimate > threshold) {
        debug(`Token estimate ${tokenEstimate} exceeds threshold ${threshold}`);
        spinner.start('Compacting conversation history...');
        const preCompactCount = messages.length;
        const compacted = await compactHistory(messages, client, model, effectiveConfig.model.contextLimit);
        const recoveredTokens = tokenEstimate - estimateMessageTokens(compacted);
        messages.length = 0;
        messages.push(...compacted);
        spinner.succeed('Context compacted');
        insightEngine?.compaction(preCompactCount, recoveredTokens);
        await fireCompact(hooks, sessionCtx);
      }

      // 2. Call Opta LMX
      insightEngine?.turnStart();
      debug(`Sending ${messages.length} messages to ${model}`);
      spinner.start('Thinking...');

      // Reconnection status handler: use TUI callback if available, otherwise log to console
      const reconnectHandler = streamCallbacks?.onConnectionStatus ?? (
        silent ? undefined : (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => {
          if (status === 'reconnecting') {
            spinner.stop();
            console.log(chalk.dim(`  Connection interrupted, reconnecting... (attempt ${attempt ?? '?'}/${effectiveConfig.connection.retry.maxRetries})`));
            spinner.start('Reconnecting...');
          } else if (status === 'connected') {
            spinner.stop();
            console.log(chalk.green('  \u2713') + chalk.dim(' Reconnected'));
            spinner.start('Thinking...');
          } else if (status === 'disconnected') {
            spinner.stop();
          }
        }
      );

      const stream = await createStreamWithRetry(
        client,
        {
          model,
          messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
          tools: activeSchemas as Parameters<typeof client.chat.completions.create>[0]['tools'],
          tool_choice: 'auto',
        },
        effectiveConfig.connection.retry,
        reconnectHandler,
      );

      spinner.stop();

      // 3. Stream tokens to terminal, collect tool calls
      statusBar?.newTurn();
      let firstText = true;
      const streamStartTime = Date.now();
      const { text, toolCalls, thinkingRenderer: lastThinking, usage } = await collectStream(stream, (chunk) => {
        if (silent) return;
        if (firstText) {
          console.log(); // blank line before response
          firstText = false;
          // Fire first-token insight for REPL mode
          insightEngine?.firstToken(Date.now() - streamStartTime);
        }
        process.stdout.write(chunk);
      }, statusBar, streamCallbacks);

      // Track last thinking renderer for expand/collapse toggle
      lastThinkingRenderer = lastThinking;

      // Set prompt tokens from API usage data (if available)
      if (usage) {
        statusBar?.setPromptTokens(usage.promptTokens);
        streamCallbacks?.onUsage?.(usage);
      }

      if (!silent && text && !firstText) {
        process.stdout.write('\n'); // newline after streamed text
      }

      // Print turn summary (tokens, speed, tool calls)
      statusBar?.finalizeTurn();
      if (!silent) statusBar?.printSummary();

      // 4. No tool calls = task complete
      if (toolCalls.length === 0) {
        // Fire turn-end insight for REPL mode
        const turnElapsed = (Date.now() - streamStartTime) / 1000;
        const turnTokens = estimateMessageTokens([{ role: 'assistant', content: text }]);
        const turnSpeed = turnElapsed > 0.1 ? turnTokens / turnElapsed : 0;
        insightEngine?.turnEnd({
          tokens: turnTokens,
          toolCalls: 0,
          elapsed: turnElapsed,
          speed: turnSpeed,
          firstTokenLatencyMs: null,
        });
        statusBar?.clear();
        break;
      }

      // 5. Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      // 6. Resolve permissions then execute tools
      const decisions = await resolveToolDecisions(toolCalls, effectiveConfig, {
        isSubAgent,
        silent,
        saveConfig: saveConfigFn,
        streamCallbacks,
        hooks,
        sessionCtx,
      });

      const execResult = await executeToolCalls(decisions, messages, {
        config: effectiveConfig,
        spinner,
        silent,
        isSubAgent,
        sessionId,
        streamCallbacks,
        insightEngine,
        hooks,
        sessionCtx,
        registry,
      }, toolCallCount, checkpointCount);

      toolCallCount += execResult.toolCallsDelta;
      checkpointCount = execResult.checkpointCount;

      // 7. Progressive circuit breaker
      const cb = effectiveConfig.safety.circuitBreaker;

      if (cb.hardStopAt > 0 && toolCallCount >= cb.hardStopAt) {
        if (!silent) console.log(chalk.red(`\n  Hard stop: ${cb.hardStopAt} tool calls reached.`));
        break;
      }

      if (cb.pauseAt > 0 && toolCallCount >= cb.pauseAt && toolCallCount % cb.pauseAt === 0) {
        // In CI or non-TTY, prompting would hang forever — just stop
        const isNonInteractive = !process.stdout.isTTY || process.env['CI'] === 'true';
        if (silent || isNonInteractive) break;
        console.log(chalk.yellow(`\n  Reached ${toolCallCount} tool calls. Pausing.`));
        const { confirm } = await import('@inquirer/prompts');
        const shouldContinue = await confirm({ message: 'Continue?' });
        if (!shouldContinue) break;
      }

      if (cb.warnAt > 0 && toolCallCount === cb.warnAt && !silent) {
        console.log(chalk.dim(`\n  Note: ${cb.warnAt} tool calls used (pauses at ${cb.pauseAt})`));
      }
    }
  } catch (err) {
    // Fire the error hook so lifecycle hooks can observe failures
    const errMsg = errorMessage(err);
    await fireError(hooks, errMsg, sessionCtx).catch(() => {});
    throw err; // Re-throw so callers (chat.ts, do.ts, server.ts) handle it
  } finally {
    // Cleanup runs whether the loop completes normally or throws

    // Auto-commit if enabled and tools were used (skip for sub-agents)
    if (!isSubAgent && effectiveConfig.git.autoCommit && toolCallCount > 0 && options?.sessionId) {
      try {
        if (await gitUtilsMod.isGitRepo(process.cwd())) {
          const modifiedFiles = await gitUtilsMod.getModifiedFiles(process.cwd());
          if (modifiedFiles.length > 0) {
            const commitMsg = await gitCommitMod.generateCommitMessage(messages, client, model);
            const committed = await gitCommitMod.commitSessionChanges(process.cwd(), modifiedFiles, commitMsg);
            if (committed && !silent) {
              console.log(chalk.green('\u2713') + chalk.dim(` Committed: ${commitMsg}`));
            }
            await gitCheckpointsMod.cleanupCheckpoints(process.cwd(), options.sessionId);
          }
        }
      } catch {
        // Auto-commit failed — non-fatal
      }
    }

    // Token usage shown by statusBar.printSummary() per turn

    await registry.close();

    // Shutdown background processes (skip for sub-agents to avoid killing parent's)
    if (!isSubAgent) {
      await shutdownProcessManager();
    }

    // Fire session end hook
    if (!isSubAgent) {
      await fireSessionEnd(hooks, sessionCtx);
    }
  }

  return { messages, toolCallCount, lastThinkingRenderer };
}
